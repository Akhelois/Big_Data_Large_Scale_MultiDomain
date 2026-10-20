"""
Embedded PC monitoring agent.

Agent ringan berbasis psutil yang memantau mesin tempat backend berjalan
sebagai background thread. Jadi setiap kali backend (uvicorn) dijalankan,
monitoring PC otomatis ikut berjalan tanpa perlu proses terpisah.

Kontrol lewat environment variable:
    EMBEDDED_AGENT   : "1" (default, aktif) atau "0" untuk mematikan
    AGENT_INTERVAL   : interval pengiriman dalam detik (default 10)

Metrik dikirim langsung ke monitoring_service.ingest() (tanpa HTTP), sehingga
data masuk ke tabel yang sama dan mendapat deteksi anomali yang sama.
Untuk memonitor PC lain, backend menyediakan script agent standalone di
endpoint GET /api/monitoring/agent-script (file app/assets/monitor_agent.py).
"""

import hashlib
import os
import socket
import threading
import time
from datetime import datetime, timezone

from app.services import monitoring_service

try:
    import platform
    import psutil
except ImportError:  # psutil belum terpasang — agent dimatikan dengan aman
    psutil = None

_enabled = os.getenv("EMBEDDED_AGENT", "1").strip().lower() not in ("0", "false", "no")
_interval = max(5.0, float(os.getenv("AGENT_INTERVAL", "10") or 10))

_thread: threading.Thread | None = None
_stop = threading.Event()
_previous_net = None


def get_local_ip() -> str:
    """IP LAN lokal: ditentukan lewat routing keluar (UDP, tanpa mengirim paket)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def make_host_id(hostname: str, ip: str) -> str:
    return hashlib.sha256(f"{hostname}::{ip}".encode()).hexdigest()[:16]


def collect_top_processes(limit=5):
    procs = []
    for p in psutil.process_iter(["pid", "name"]):
        try:
            procs.append((p.info["pid"], p.info["name"], p.cpu_percent(interval=None)))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x[2], reverse=True)
    return [
        {"pid": pid, "name": (name or "unknown")[:60], "cpu_percent": round(cpu, 1)}
        for pid, name, cpu in procs[:limit]
    ]


def collect_metrics(previous_net):
    """Return (metrics_dict, net_counters_terkini)."""
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_per_core = psutil.cpu_percent(interval=None, percpu=True)

    vm = psutil.virtual_memory()
    du = psutil.disk_usage(os.path.abspath(os.sep) if os.name == "nt" else "/")

    net = psutil.net_io_counters()
    now = time.time()
    if previous_net is not None:
        prev_counters, prev_time = previous_net
        dt = max(now - prev_time, 1e-6)
        net_sent_kbps = max((net.bytes_sent - prev_counters.bytes_sent) / dt / 1024.0, 0.0)
        net_recv_kbps = max((net.bytes_recv - prev_counters.bytes_recv) / dt / 1024.0, 0.0)
    else:
        net_sent_kbps = 0.0
        net_recv_kbps = 0.0

    return {
        "cpu_percent": round(cpu_percent, 1),
        "cpu_per_core": [round(c, 1) for c in cpu_per_core],
        "mem_percent": round(vm.percent, 1),
        "mem_used_gb": round(vm.used / 1024**3, 2),
        "mem_total_gb": round(vm.total / 1024**3, 2),
        "disk_percent": round(du.percent, 1),
        "disk_used_gb": round(du.used / 1024**3, 2),
        "disk_total_gb": round(du.total / 1024**3, 2),
        "net_sent_kbps": round(net_sent_kbps, 1),
        "net_recv_kbps": round(net_recv_kbps, 1),
        "top_processes": collect_top_processes(),
    }, (net, now)


def _loop():
    global _previous_net
    hostname = socket.gethostname()
    ip = get_local_ip()
    host_id = make_host_id(hostname, ip)
    os_name = f"{platform.system()} {platform.release()}"

    print(f"[embedded-agent] host={hostname} ip={ip} interval={_interval}s")

    # warm-up psutil agar iterasi pertama valid
    psutil.cpu_percent(interval=None)
    for p in psutil.process_iter():
        try:
            p.cpu_percent(interval=None)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    while not _stop.is_set():
        try:
            metrics, counters = collect_metrics(_previous_net)
            _previous_net = counters
            monitoring_service.ingest({
                "host_id": host_id,
                "hostname": hostname,
                "ip": ip,
                "os": os_name,
                "domain_hint": "Backend host",
                "ts": datetime.now(timezone.utc).isoformat(),
                "metrics": metrics,
            })
        except Exception as exc:  # jangan pernah matikan thread backend
            print(f"[embedded-agent] error: {exc}")
        _stop.wait(_interval)


def start():
    """Jalankan agent sebagai daemon thread. Aman dipanggil berulang kali."""
    global _thread
    if not _enabled:
        print("[embedded-agent] dinonaktifkan lewat EMBEDDED_AGENT=0")
        return
    if psutil is None:
        print("[embedded-agent] psutil belum terpasang (pip install psutil) — agent dilewati")
        return
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, daemon=True, name="pc-monitoring-agent")
    _thread.start()


def stop():
    _stop.set()
