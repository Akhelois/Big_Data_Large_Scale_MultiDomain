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


def list_hosts() -> list[dict]:
    """Daftar host yang dikenal + snapshot metrik terakhirnya."""
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
    return hosts


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
        "matrix": [[round(float(v), 3) for v in row] for row in corr.values],
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
