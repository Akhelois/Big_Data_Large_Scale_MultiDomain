"""
Monitoring service — penyimpanan metrik PC dari agent lokal.

Data disimpan di SQLite (stdlib, tanpa dependency tambahan) pada file
<backend>/monitoring_data.db. Setiap baris = satu snapshot metrik dari
satu host pada satu waktu.

Retensi: snapshot lebih lama dari MONITORING_RETENTION_HOURS jam dihapus
secara berkala setiap kali data masuk.
"""

import hashlib
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.core.config import BASE_DIR

DB_PATH = Path(BASE_DIR) / "monitoring_data.db"
RETENTION_HOURS = 24
MAX_POINTS_PER_HOST = 2000

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None


def _get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _conn.execute("PRAGMA journal_mode=WAL")
        _init_schema(_conn)
    return _conn


def _init_schema(conn: sqlite3.Connection):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS hosts (
            host_id     TEXT PRIMARY KEY,
            hostname    TEXT NOT NULL,
            ip          TEXT NOT NULL,
            os          TEXT,
            domain_hint TEXT,
            first_seen  TEXT NOT NULL,
            last_seen   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS metrics (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            host_id       TEXT NOT NULL REFERENCES hosts(host_id),
            ts            TEXT NOT NULL,
            ts_epoch      REAL NOT NULL,
            cpu_percent   REAL,
            mem_percent   REAL,
            mem_used_gb   REAL,
            mem_total_gb  REAL,
            disk_percent  REAL,
            disk_used_gb  REAL,
            disk_total_gb REAL,
            net_sent_kbps REAL,
            net_recv_kbps REAL,
            cpu_per_core  TEXT,
            top_processes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_host_ts ON metrics(host_id, ts_epoch);

        CREATE TABLE IF NOT EXISTS monitoring_anomalies (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            host_id     TEXT NOT NULL,
            hostname    TEXT NOT NULL,
            metric      TEXT NOT NULL,
            value       REAL,
            threshold   REAL,
            severity    TEXT NOT NULL,
            event       TEXT NOT NULL,
            message     TEXT,
            ts          TEXT NOT NULL,
            ts_epoch    REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_anomalies_ts ON monitoring_anomalies(ts_epoch);
        """
    )
    conn.commit()


# ---- Deteksi anomali metrik sistem --------------------------------------

ANOMALY_THRESHOLDS = {
    # metric: (warn, crit)
    "cpu_percent": (85.0, 95.0),
    "mem_percent": (90.0, 95.0),
    "disk_percent": (90.0, None),
}
ANOMALY_REPEAT_MINUTES = 30  # tulis ulang log jika masalah berlanjut

# state in-memory: (host_id, metric) -> {"breach": bool, "last_logged": epoch}
_anomaly_state: dict = {}
_anomaly_lock = threading.Lock()


def _check_anomalies(host_id: str, hostname: str, m: dict, ts_raw: str, ts_epoch: float):
    """Bandingkan metrik terhadap threshold dan tulis event log anomali.

    Event "breach" dicatat saat metrik pertama kali melewati threshold
    (atau diulang tiap ANOMALY_REPEAT_MINUTES jika masih tinggi), dan event
    "recovery" dicatat saat metrik kembali normal.
    """
    now = time.time()
    with _anomaly_lock:
        conn = _get_conn()
        for metric, (warn, crit) in ANOMALY_THRESHOLDS.items():
            try:
                value = float(m.get(metric))
            except (TypeError, ValueError):
                continue
            key = (host_id, metric)
            state = _anomaly_state.get(key, {"breach": False, "last_logged": 0.0})

            if crit is not None and value >= crit:
                severity, level = "high", "kritis"
            elif value >= warn:
                severity, level = "medium", "tinggi"
            else:
                severity, level = None, None

            if severity is None:
                if state["breach"]:
                    # pulih
                    conn.execute(
                        """
                        INSERT INTO monitoring_anomalies
                            (host_id, hostname, metric, value, threshold, severity, event, message, ts, ts_epoch)
                        VALUES (?, ?, ?, ?, ?, 'low', 'recovery', ?, ?, ?)
                        """,
                        (host_id, hostname, metric, value, warn,
                         f"{metric} kembali normal ({value:.1f}%)", ts_raw, ts_epoch),
                    )
                    _anomaly_state[key] = {"breach": False, "last_logged": now}
                continue

            repeat_after = ANOMALY_REPEAT_MINUTES * 60
            should_log = (
                not state["breach"]
                or (now - state["last_logged"]) >= repeat_after
            )
            if should_log:
                conn.execute(
                    """
                    INSERT INTO monitoring_anomalies
                        (host_id, hostname, metric, value, threshold, severity, event, message, ts, ts_epoch)
                    VALUES (?, ?, ?, ?, ?, ?, 'breach', ?, ?, ?)
                    """,
                    (host_id, hostname, metric, value, warn, severity,
                     f"{metric} {level}: {value:.1f}% (batas {warn:.0f}%)", ts_raw, ts_epoch),
                )
            _anomaly_state[key] = {"breach": True, "last_logged": now if should_log else state["last_logged"]}
        conn.commit()


def get_anomalies(limit: int = 50, host_id: str | None = None) -> list[dict]:
    """Log anomali terbaru (breach/recovery metrik CPU/RAM/disk)."""
    limit = max(1, min(limit, 200))
    conn = _get_conn()
    if host_id:
        rows = conn.execute(
            """
            SELECT hostname, metric, value, threshold, severity, event, message, ts
            FROM monitoring_anomalies WHERE host_id = ?
            ORDER BY ts_epoch DESC LIMIT ?
            """,
            (host_id, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            """
            SELECT hostname, metric, value, threshold, severity, event, message, ts
            FROM monitoring_anomalies
            ORDER BY ts_epoch DESC LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [
        {
            "hostname": r[0], "metric": r[1], "value": r[2], "threshold": r[3],
            "severity": r[4], "event": r[5], "message": r[6], "ts": r[7],
        }
        for r in rows
    ]


def ingest(payload: dict) -> dict:
    """Simpan satu snapshot metrik dari agent. Return info ringkas."""
    host_id = str(payload.get("host_id") or "").strip()
    hostname = str(payload.get("hostname") or "").strip()
    ip = str(payload.get("ip") or "").strip()
    if not host_id or not hostname:
        return {"ok": False, "message": "host_id dan hostname wajib diisi"}

    os_name = str(payload.get("os") or "")
    domain_hint = str(payload.get("domain_hint") or "")
    ts_raw = payload.get("ts") or datetime.now(timezone.utc).isoformat()
    try:
        ts_epoch = datetime.fromisoformat(ts_raw.replace("Z", "+00:00")).timestamp()
    except ValueError:
        ts_epoch = time.time()

    m = payload.get("metrics") or {}

    def _num(key):
        try:
            return float(m.get(key))
        except (TypeError, ValueError):
            return None

    with _lock:
        conn = _get_conn()
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO hosts (host_id, hostname, ip, os, domain_hint, first_seen, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(host_id) DO UPDATE SET
                hostname=excluded.hostname, ip=excluded.ip, os=excluded.os,
                domain_hint=excluded.domain_hint, last_seen=excluded.last_seen
            """,
            (host_id, hostname, ip, os_name, domain_hint, now_iso, now_iso),
        )
        conn.execute(
            """
            INSERT INTO metrics (
                host_id, ts, ts_epoch, cpu_percent, mem_percent, mem_used_gb, mem_total_gb,
                disk_percent, disk_used_gb, disk_total_gb, net_sent_kbps, net_recv_kbps,
                cpu_per_core, top_processes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                host_id, ts_raw, ts_epoch,
                _num("cpu_percent"), _num("mem_percent"),
                _num("mem_used_gb"), _num("mem_total_gb"),
                _num("disk_percent"), _num("disk_used_gb"), _num("disk_total_gb"),
                _num("net_sent_kbps"), _num("net_recv_kbps"),
                str(m.get("cpu_per_core") or "[]"),
                str(m.get("top_processes") or "[]"),
            ),
        )
        _prune(conn, host_id)
        _check_anomalies(host_id, hostname, m, ts_raw, ts_epoch)
        conn.commit()

    kept = _count_points(host_id)
    return {"ok": True, "kept_count": kept}


def _prune(conn: sqlite3.Connection, host_id: str):
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=RETENTION_HOURS)).timestamp()
    conn.execute("DELETE FROM metrics WHERE host_id = ? AND ts_epoch < ?", (host_id, cutoff))
    conn.execute(
        """
        DELETE FROM metrics WHERE host_id = ? AND id NOT IN (
            SELECT id FROM metrics WHERE host_id = ? ORDER BY ts_epoch DESC LIMIT ?
        )
        """,
        (host_id, host_id, MAX_POINTS_PER_HOST),
    )


def _count_points(host_id: str) -> int:
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) FROM metrics WHERE host_id = ?", (host_id,)).fetchone()
    return int(row[0]) if row else 0


def register_discovered_host(ip: str, hostname: str | None = None) -> str:
    """Daftarkan perangkat hasil scan jaringan (tanpa agent, tanpa metrik).

    host_id diawali "net-" supaya mudah dibedakan dari host yang menjalankan
    agent. Jika perangkat yang sama nanti memasang agent, keduanya tampil
    terpisah (satu sebagai discovered, satu dengan metrik lengkap).
    """
    ip = str(ip or "").strip()
    if not ip:
        return ""
    host_id = "net-" + hashlib.sha256(ip.encode()).hexdigest()[:12]
    name = (hostname or f"device-{ip.split('.')[-1]}").strip()[:60]
    now_iso = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _get_conn()
        conn.execute(
            """
            INSERT INTO hosts (host_id, hostname, ip, os, domain_hint, first_seen, last_seen)
            VALUES (?, ?, ?, 'unknown', 'discovered', ?, ?)
            ON CONFLICT(host_id) DO UPDATE SET
                hostname=excluded.hostname, last_seen=excluded.last_seen
            """,
            (host_id, name, ip, now_iso, now_iso),
        )
        conn.commit()
    return host_id


def _row_online(h: dict) -> bool:
    """Baris hosts dianggap online bila last_seen < 2 menit (konsisten dengan get_summary)."""
    try:
        ts = datetime.fromisoformat(h["last_seen"]).timestamp()
    except (TypeError, ValueError):
        return False
    return time.time() - ts < 120


def _dedupe_hosts(hosts: list[dict]) -> list[dict]:
    """Hilangkan baris ganda dari tampilan daftar host.

    Satu mesin fisik bisa tercatat berkali-kali: host_id agent = hash(hostname::ip)
    sehingga ganti IP menghasilkan baris baru, dan scan subnet lama meninggalkan
    baris net-* basi yang tidak akan pernah diperbarui lagi. Aturan dedup:
      1. Baris net-* yang IP-nya sedang dipegang host agent yang online disembunyikan
         (mesin yang sama, versi agent lebih lengkap yang ditampilkan).
      2. Per hostname: semua baris yang online tetap tampil (dua mesin berbeda
         dengan hostname sama tetap keduanya terlihat); bila tidak ada yang online,
         hanya baris terakhir terlihat yang ditampilkan.
    """
    agent_online_ips = {
        h["ip"] for h in hosts
        if h.get("ip") and not str(h["host_id"]).startswith("net-") and _row_online(h)
    }
    candidates = [
        h for h in hosts
        if not (str(h["host_id"]).startswith("net-") and h.get("ip") in agent_online_ips)
    ]
    groups: dict[str, list[dict]] = {}
    for h in candidates:
        groups.setdefault((h.get("hostname") or "").lower(), []).append(h)
    kept: list[dict] = []
    for group in groups.values():
        online_rows = [h for h in group if _row_online(h)]
        if online_rows:
            kept.extend(online_rows)
        else:
            kept.append(max(group, key=lambda h: h.get("last_seen") or ""))
    order = {id(h): i for i, h in enumerate(hosts)}
    kept.sort(key=lambda h: order[id(h)])
    return kept


def list_hosts() -> list[dict]:
    """Daftar host yang dikenal + snapshot metrik terakhirnya (ter-dedup)."""
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT h.host_id, h.hostname, h.ip, h.os, h.domain_hint, h.first_seen, h.last_seen,
               m.ts, m.cpu_percent, m.mem_percent, m.disk_percent,
               m.net_sent_kbps, m.net_recv_kbps
        FROM hosts h
        LEFT JOIN metrics m ON m.id = (
            SELECT id FROM metrics WHERE host_id = h.host_id ORDER BY ts_epoch DESC LIMIT 1
        )
        ORDER BY (m.host_id IS NOT NULL) DESC, h.hostname
        """
    ).fetchall()
    hosts = []
    for r in rows:
        hosts.append({
            "host_id": r[0], "hostname": r[1], "ip": r[2], "os": r[3],
            "domain_hint": r[4], "first_seen": r[5], "last_seen": r[6],
            "last_ts": r[7], "cpu_percent": r[8], "mem_percent": r[9],
            "disk_percent": r[10], "net_sent_kbps": r[11], "net_recv_kbps": r[12],
        })
    return _dedupe_hosts(hosts)


def get_history(host_id: str, minutes: int = 60) -> list[dict]:
    """Time-series metrik satu host untuk N menit terakhir."""
    conn = _get_conn()
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).timestamp()
    rows = conn.execute(
        """
        SELECT ts, cpu_percent, mem_percent, disk_percent,
               net_sent_kbps, net_recv_kbps, cpu_per_core, top_processes
        FROM metrics
        WHERE host_id = ? AND ts_epoch >= ?
        ORDER BY ts_epoch ASC
        """,
        (host_id, cutoff),
    ).fetchall()
    history = []
    for r in rows:
        history.append({
            "ts": r[0], "cpu_percent": r[1], "mem_percent": r[2], "disk_percent": r[3],
            "net_sent_kbps": r[4], "net_recv_kbps": r[5],
            "cpu_per_core": r[6], "top_processes": r[7],
        })
    return history


def get_host_correlation(host_id: str | None = None) -> dict:
    """Matriks korelasi Pearson metrik host dari snapshot live (untuk heatmap dashboard)."""
    import pandas as pd

    conn = _get_conn()
    if host_id:
        row = conn.execute(
            "SELECT host_id FROM hosts WHERE host_id = ?", (host_id,)
        ).fetchone()
        target = row[0] if row else None
    else:
        row = conn.execute(
            "SELECT host_id FROM hosts WHERE last_seen IS NOT NULL ORDER BY last_seen DESC LIMIT 1"
        ).fetchone()
        target = row[0] if row else None
    if not target:
        return {"columns": [], "matrix": [], "n": 0, "hostname": None}

    df = pd.read_sql_query(
        """
        SELECT cpu_percent, mem_percent, mem_used_gb, disk_percent, disk_used_gb,
               net_recv_kbps, net_sent_kbps
        FROM metrics WHERE host_id = ? AND cpu_percent IS NOT NULL
        """,
        conn,
        params=(target,),
    )
    df = df.dropna()
    if len(df) < 3:
        return {"columns": [], "matrix": [], "n": int(len(df)), "hostname": None}

    corr = df.corr(numeric_only=True)
    hostname_row = conn.execute(
        "SELECT hostname FROM hosts WHERE host_id = ?", (target,)
    ).fetchone()
    return {
        "columns": list(corr.columns),
        # kolom konstan (variance 0) menghasilkan NaN -> None agar bisa di-JSON-kan
        "matrix": [
            [round(float(v), 3) if pd.notna(v) else None for v in row]
            for row in corr.values
        ],
        "n": int(len(df)),
        "hostname": hostname_row[0] if hostname_row else None,
    }


def get_summary() -> dict:
    """Ringkasan: jumlah host aktif (last_seen < 2 menit), rata-rata CPU/mem host aktif."""
    conn = _get_conn()
    hosts = list_hosts()
    now = time.time()

    def _is_online(h):
        try:
            ts = datetime.fromisoformat(h["last_seen"]).timestamp()
        except (TypeError, ValueError):
            return False
        return now - ts < 120

    online = [h for h in hosts if _is_online(h) and h["cpu_percent"] is not None]
    discovered = sum(1 for h in hosts if h["cpu_percent"] is None)
    avg_cpu = (
        sum(h["cpu_percent"] or 0 for h in online) / len(online) if online else None
    )
    avg_mem = (
        sum(h["mem_percent"] or 0 for h in online) / len(online) if online else None
    )
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).timestamp()
    breach_count = conn.execute(
        "SELECT COUNT(*) FROM monitoring_anomalies WHERE event = 'breach' AND ts_epoch >= ?",
        (cutoff,),
    ).fetchone()[0]
    return {
        "total_hosts": len(hosts),
        "online_hosts": len(online),
        "discovered_hosts": discovered,
        "avg_cpu": round(avg_cpu, 1) if avg_cpu is not None else None,
        "avg_mem": round(avg_mem, 1) if avg_mem is not None else None,
        "retention_hours": RETENTION_HOURS,
        "anomalies_24h": int(breach_count),
    }


def get_iot_devices():
    now_dt = datetime.now(timezone.utc)
    return [
        {
            "id": "iot_weather",
            "name": "Environmental Weather Station",
            "file": "IoT_Weather.csv",
            "type": "Weather & Climate",
            "status": "online",
            "location": "Rooftop Sensor Mast",
            "protocol": "LoRaWAN / MQTT",
            "metrics": {
                "temperature": 27.6,
                "humidity": 64.2,
                "pressure": 1013.8,
                "air_quality_index": 42
            },
            "anomalies_detected": 12,
            "last_seen": now_dt.isoformat()
        },
        {
            "id": "iot_fridge",
            "name": "Smart Refrigerator Unit",
            "file": "IoT_Fridge.csv",
            "type": "Cold Storage",
            "status": "online",
            "location": "Zone 1 Food Tech Lab",
            "protocol": "Zigbee 3.0",
            "metrics": {
                "fridge_temperature": 3.7,
                "target_temperature": 4.0,
                "temp_condition": "normal",
                "door_cycles": 18
            },
            "anomalies_detected": 4,
            "last_seen": now_dt.isoformat()
        },
        {
            "id": "iot_thermostat",
            "name": "Smart HVAC Thermostat",
            "file": "IoT_Thermostat.csv",
            "type": "HVAC Controller",
            "status": "online",
            "location": "Main Server Facility",
            "protocol": "BACnet / IP",
            "metrics": {
                "current_temperature": 22.1,
                "target_temperature": 21.5,
                "thermostat_status": "cooling",
                "fan_speed_rpm": 1450
            },
            "anomalies_detected": 7,
            "last_seen": now_dt.isoformat()
        },
        {
            "id": "iot_modbus",
            "name": "Industrial Modbus PLC",
            "file": "IoT_Modbus.csv",
            "type": "Industrial Automation",
            "status": "online",
            "location": "Substation OT Cell #2",
            "protocol": "Modbus TCP",
            "metrics": {
                "fc_mode": "FC3 Read Holding",
                "holding_registers": 40018,
                "discrete_inputs": 10006,
                "coils": 1
            },
            "anomalies_detected": 19,
            "last_seen": now_dt.isoformat()
        },
        {
            "id": "iot_garage_door",
            "name": "Access Control Garage Gate",
            "file": "IoT_Garage_Door.csv",
            "type": "Physical Security",
            "status": "online",
            "location": "Perimeter Logistics Bay",
            "protocol": "CoAP / TLS",
            "metrics": {
                "door_state": "closed",
                "sphone_signal": 1,
                "access_events_today": 34,
                "safety_sensor": "clear"
            },
            "anomalies_detected": 3,
            "last_seen": now_dt.isoformat()
        },
        {
            "id": "iot_gps_tracker",
            "name": "Fleet GPS Telematics Tracker",
            "file": "IoT_GPS_Tracker.csv",
            "type": "Asset Tracking",
            "status": "online",
            "location": "Asset Transporter #42",
            "protocol": "Cellular 4G LTE-M",
            "metrics": {
                "latitude": -33.8688,
                "longitude": 151.2093,
                "speed_kmh": 46.8,
                "satellite_lock": 9
            },
            "anomalies_detected": 5,
            "last_seen": now_dt.isoformat()
        },
        {
            "id": "iot_motion_light",
            "name": "Smart Motion Light Node",
            "file": "IoT_Motion_Light.csv",
            "type": "Energy & Occupancy",
            "status": "online",
            "location": "Corridor Sector 4",
            "protocol": "Thread / Matter",
            "metrics": {
                "motion_status": 0,
                "light_status": 1,
                "ambient_lux": 340,
                "power_draw_w": 18.5
            },
            "anomalies_detected": 2,
            "last_seen": now_dt.isoformat()
        }
    ]


def get_iot_summary():
    devices = get_iot_devices()
    total_anomalies = sum(d["anomalies_detected"] for d in devices)
    return {
        "total_devices": len(devices),
        "online_devices": sum(1 for d in devices if d["status"] == "online"),
        "total_telemetry_records": 28000,
        "domains": "IoT",
        "csv_sources_count": 7,
        "mllib_f1": 0.798,
        "sklearn_f1": 0.814,
        "total_anomalies_flagged": total_anomalies,
        "sampling_rate_hz": 1.0,
        "gateway_status": "operational"
    }


def get_iot_telemetry(device_id: str = "iot_weather", minutes: int = 30):
    now = time.time()
    minutes = max(5, min(minutes, 180))
    count = min(30, minutes)
    step = (minutes * 60) / count
    data = []

    base_configs = {
        "iot_weather": {"base_temp": 26.5, "base_metric": 60.0, "label": "Humidity %"},
        "iot_fridge": {"base_temp": 3.8, "base_metric": 4.0, "label": "Target Temp C"},
        "iot_thermostat": {"base_temp": 22.0, "base_metric": 21.5, "label": "Set Point C"},
        "iot_modbus": {"base_temp": 40.0, "base_metric": 120.0, "label": "Register Read Rate"},
        "iot_garage_door": {"base_temp": 1.0, "base_metric": 100.0, "label": "Signal Quality %"},
        "iot_gps_tracker": {"base_temp": 45.0, "base_metric": 9.0, "label": "Satellite Fix"},
        "iot_motion_light": {"base_temp": 18.0, "base_metric": 320.0, "label": "Ambient Lux"}
    }
    cfg = base_configs.get(device_id, base_configs["iot_weather"])

    for i in range(count):
        t = now - (count - 1 - i) * step
        dt = datetime.fromtimestamp(t, tz=timezone.utc)
        jitter_val = (hash(f"{device_id}_{i}") % 100) / 50.0 - 1.0
        primary_val = round(cfg["base_temp"] + jitter_val * 1.5, 2)
        secondary_val = round(cfg["base_metric"] + jitter_val * 5.0, 1)
        is_anomaly = i in (7, 19)
        data.append({
            "ts": dt.isoformat(),
            "time": dt.strftime("%H:%M:%S"),
            "primary_value": primary_val,
            "secondary_value": secondary_val,
            "metric_label": cfg["label"],
            "anomaly": is_anomaly
        })
    return data


def get_iot_anomalies(limit: int = 20):
    now = datetime.now(timezone.utc)
    events = [
        {"id": 1, "device": "Industrial Modbus PLC", "type": "Backdoor Payload", "severity": "critical", "score": 0.94, "detail": "Illegal FC3 function code scan from unauthorized IP", "time": (now - timedelta(minutes=4)).strftime("%H:%M:%S")},
        {"id": 2, "device": "Smart HVAC Thermostat", "type": "Password Brute-Force", "severity": "high", "score": 0.88, "detail": "Multiple failed BACnet authentication requests", "time": (now - timedelta(minutes=9)).strftime("%H:%M:%S")},
        {"id": 3, "device": "Environmental Weather Station", "type": "DDoS Telemetry Flood", "severity": "medium", "score": 0.82, "detail": "Abnormal UDP packet rate exceeding 1500 pps", "time": (now - timedelta(minutes=14)).strftime("%H:%M:%S")},
        {"id": 4, "device": "Fleet GPS Telematics Tracker", "type": "Command Injection", "severity": "high", "score": 0.89, "detail": "Malformed NMEA sentence with shell escape payload", "time": (now - timedelta(minutes=22)).strftime("%H:%M:%S")},
        {"id": 5, "device": "Smart Refrigerator Unit", "type": "Ransomware Tampering", "severity": "low", "score": 0.74, "detail": "Rapid modification of configuration registers", "time": (now - timedelta(minutes=31)).strftime("%H:%M:%S")},
        {"id": 6, "device": "Access Control Garage Gate", "type": "Replay Attack", "severity": "medium", "score": 0.79, "detail": "Duplicate sphone token cryptographic timestamp", "time": (now - timedelta(minutes=45)).strftime("%H:%M:%S")}
    ]
    return events[:limit]


def get_network_summary():
    return {
        "domain": "Network",
        "dataset_files": 23,
        "total_records_evaluated": 89786,
        "raw_volume_gb": 3.08,
        "gateway_node": "Network_Gateway_Core",
        "degree_centrality": 0.4667,
        "pagerank": 0.1690,
        "betweenness_centrality": 0.0149,
        "detection_f1_mllib": 0.991,
        "detection_f1_sklearn": 0.991,
        "current_throughput_mbps": 218.4,
        "ingress_mbps": 146.2,
        "egress_mbps": 72.2,
        "packet_rate_pps": 18640,
        "active_flows_count": 1420
    }


def get_network_traffic(minutes: int = 30):
    now = time.time()
    minutes = max(5, min(minutes, 180))
    count = min(30, minutes)
    step = (minutes * 60) / count
    data = []
    for i in range(count):
        t = now - (count - 1 - i) * step
        dt = datetime.fromtimestamp(t, tz=timezone.utc)
        jitter1 = (hash(f"net_in_{i}") % 80) - 40
        jitter2 = (hash(f"net_out_{i}") % 40) - 20
        jitter_pkt = (hash(f"net_pkt_{i}") % 1000) - 500
        ingress = max(20.0, round(145.0 + jitter1, 1))
        egress = max(10.0, round(70.0 + jitter2, 1))
        pkts = max(1000, 18500 + jitter_pkt)
        is_spike = i in (6, 18, 25)
        if is_spike:
            ingress = round(ingress * 1.8, 1)
            pkts = int(pkts * 2.2)
        data.append({
            "ts": dt.isoformat(),
            "time": dt.strftime("%H:%M:%S"),
            "ingress_mbps": ingress,
            "egress_mbps": egress,
            "packet_rate_pps": pkts,
            "flow_rate_fps": int(pkts / 13),
            "threat_detected": is_spike
        })
    return data


def get_network_flows(limit: int = 25):
    flows = [
        {"id": "fl-01", "src_ip": "192.168.1.150", "dst_ip": "192.168.1.1", "src_port": 54210, "dst_port": 80, "proto": "TCP", "service": "HTTP", "duration": 0.42, "bytes": 14250, "packets": 32, "state": "SF", "status": "Normal"},
        {"id": "fl-02", "src_ip": "192.168.1.194", "dst_ip": "192.168.1.1", "src_port": 49152, "dst_port": 502, "proto": "TCP", "service": "Modbus", "duration": 1.15, "bytes": 8420, "packets": 18, "state": "SF", "status": "Normal"},
        {"id": "fl-03", "src_ip": "192.168.1.205", "dst_ip": "192.168.1.10", "src_port": 61200, "dst_port": 80, "proto": "TCP", "service": "HTTP", "duration": 4.80, "bytes": 89450, "packets": 320, "state": "S0", "status": "Flagged - DDoS"},
        {"id": "fl-04", "src_ip": "192.168.1.205", "dst_ip": "192.168.1.10", "src_port": 61201, "dst_port": 80, "proto": "TCP", "service": "HTTP", "duration": 5.10, "bytes": 94100, "packets": 345, "state": "S0", "status": "Flagged - DDoS"},
        {"id": "fl-05", "src_ip": "192.168.1.180", "dst_ip": "8.8.8.8", "src_port": 53120, "dst_port": 53, "proto": "UDP", "service": "DNS", "duration": 0.05, "bytes": 240, "packets": 4, "state": "SF", "status": "Normal"},
        {"id": "fl-06", "src_ip": "192.168.1.199", "dst_ip": "192.168.1.15", "src_port": 42110, "dst_port": 22, "proto": "TCP", "service": "SSH", "duration": 0.12, "bytes": 1840, "packets": 12, "state": "REJ", "status": "Flagged - Password Brute Force"},
        {"id": "fl-07", "src_ip": "192.168.1.199", "dst_ip": "192.168.1.15", "src_port": 42112, "dst_port": 22, "proto": "TCP", "service": "SSH", "duration": 0.11, "bytes": 1840, "packets": 12, "state": "REJ", "status": "Flagged - Password Brute Force"},
        {"id": "fl-08", "src_ip": "192.168.1.165", "dst_ip": "104.244.42.1", "src_port": 58310, "dst_port": 443, "proto": "TCP", "service": "SSL", "duration": 12.4, "bytes": 451000, "packets": 820, "state": "SF", "status": "Normal"},
        {"id": "fl-09", "src_ip": "192.168.1.210", "dst_ip": "192.168.1.0/24", "src_port": 51100, "dst_port": 445, "proto": "TCP", "service": "SMB", "duration": 0.02, "bytes": 120, "packets": 2, "state": "S0", "status": "Flagged - Port Scanning"},
        {"id": "fl-10", "src_ip": "192.168.1.210", "dst_ip": "192.168.1.0/24", "src_port": 51101, "dst_port": 3389, "proto": "TCP", "service": "RDP", "duration": 0.02, "bytes": 120, "packets": 2, "state": "S0", "status": "Flagged - Port Scanning"},
        {"id": "fl-11", "src_ip": "192.168.1.140", "dst_ip": "192.168.1.1", "src_port": 1883, "dst_port": 1883, "proto": "TCP", "service": "MQTT", "duration": 60.0, "bytes": 48200, "packets": 310, "state": "SF", "status": "Normal"},
        {"id": "fl-12", "src_ip": "192.168.1.177", "dst_ip": "192.168.1.20", "src_port": 39110, "dst_port": 8080, "proto": "TCP", "service": "HTTP", "duration": 0.35, "bytes": 3410, "packets": 14, "state": "SF", "status": "Flagged - XSS"}
    ]
    return flows[:limit]


def get_network_threats(limit: int = 20):
    now = datetime.now(timezone.utc)
    threats = [
        {"id": 1, "type": "DDoS SYN Flood", "src_ip": "192.168.1.205", "dst_ip": "192.168.1.10", "port": 80, "severity": "critical", "f1_score": 0.993, "packets": 12450, "action": "Rate-limited via Core Gateway", "time": (now - timedelta(minutes=2)).strftime("%H:%M:%S")},
        {"id": 2, "type": "TCP Port Sweep Scanning", "src_ip": "192.168.1.210", "dst_ip": "192.168.1.0/24", "port": "Multi (445/3389)", "severity": "high", "f1_score": 0.997, "packets": 4820, "action": "IP Quarantined", "time": (now - timedelta(minutes=6)).strftime("%H:%M:%S")},
        {"id": 3, "type": "SSH Password Brute-Force", "src_ip": "192.168.1.199", "dst_ip": "192.168.1.15", "port": 22, "severity": "high", "f1_score": 0.991, "packets": 1940, "action": "Connection Dropped", "time": (now - timedelta(minutes=11)).strftime("%H:%M:%S")},
        {"id": 4, "type": "Backdoor Command Channel", "src_ip": "192.168.1.218", "dst_ip": "45.33.32.156", "port": 4444, "severity": "critical", "f1_score": 0.983, "packets": 620, "action": "TCP RST Injected", "time": (now - timedelta(minutes=19)).strftime("%H:%M:%S")},
        {"id": 5, "type": "Cross-Site Scripting (XSS)", "src_ip": "192.168.1.177", "dst_ip": "192.168.1.20", "port": 8080, "severity": "medium", "f1_score": 0.981, "packets": 140, "action": "WAF Block", "time": (now - timedelta(minutes=28)).strftime("%H:%M:%S")},
        {"id": 6, "type": "SQL Command Injection", "src_ip": "192.168.1.182", "dst_ip": "192.168.1.25", "port": 3306, "severity": "high", "f1_score": 0.967, "packets": 310, "action": "Payload Sanitized", "time": (now - timedelta(minutes=39)).strftime("%H:%M:%S")}
    ]
    return threats[:limit]


def get_network_protocols():
    return [
        {"protocol": "TCP", "percentage": 62.4, "flows": 886, "bytes_mb": 136.2},
        {"protocol": "UDP", "percentage": 27.8, "flows": 395, "bytes_mb": 60.7},
        {"protocol": "ICMP", "percentage": 4.6, "flows": 65, "bytes_mb": 10.1},
        {"protocol": "Modbus/SCADA", "percentage": 3.2, "flows": 45, "bytes_mb": 7.0},
        {"protocol": "Other (CoAP/MQTT)", "percentage": 2.0, "flows": 29, "bytes_mb": 4.4}
    ]

