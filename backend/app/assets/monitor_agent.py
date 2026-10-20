#!/usr/bin/env python3
"""
PC Monitoring Agent (standalone) — Multidomain Analytics
=========================================================
Agent ringan berbasis psutil untuk memonitor PC LAIN di jaringan lokal dan
mengirim metriknya ke backend Multidomain Analytics API.

Cara pakai (dari PC yang ingin dimonitor):
    # 1. Unduh script ini dari backend:
    curl http://<ip-backend>:8000/api/monitoring/agent-script -o agent.py
    # 2. Pasang dependency:
    pip install psutil
    # 3. Jalankan:
    python agent.py --backend http://<ip-backend>:8000 --interval 10

Catatan: host tempat backend berjalan TIDAK perlu script ini — backend sudah
memantau dirinya sendiri lewat embedded agent otomatis.
"""

import argparse
import hashlib
import json
import os
import socket
import sys
import time
from datetime import datetime, timezone
from urllib import request as urlrequest
from urllib.error import URLError, HTTPError

try:
    import psutil
except ImportError:
    sys.exit("psutil belum terpasang. Jalankan: pip install psutil requests")


# ---------------------------------------------------------------- utilitas

def get_local_ip():
    """IP LAN lokal: ditentukan lewat routing keluar (UDP, tanpa mengirim paket)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def make_host_id(hostname, ip):
    raw = f"{hostname}::{ip}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


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
        "_net_counters": (net, now),
    }


# ---------------------------------------------------------------- pengiriman

def send_payload(backend_url, payload, timeout=5):
    data = json.dumps(payload).encode()
    req = urlrequest.Request(
        f"{backend_url.rstrip('/')}/api/monitoring/ingest",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlrequest.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read().decode())
            return resp.status, body
    except (HTTPError, URLError, TimeoutError) as exc:
        return None, str(exc)


# ---------------------------------------------------------------- main loop

def main():
    parser = argparse.ArgumentParser(description="PC monitoring agent (standalone)")
    parser.add_argument("--backend", default=os.getenv("BACKEND_URL", "http://localhost:8000"),
                        help="URL backend, contoh: http://10.38.10.84:8000")
    parser.add_argument("--interval", type=float, default=float(os.getenv("AGENT_INTERVAL", "10")),
                        help="Interval pengiriman dalam detik (default 10)")
    parser.add_argument("--once", action="store_true", help="Kirim satu kali lalu keluar (untuk testing)")
    args = parser.parse_args()

    hostname = socket.gethostname()
    ip = get_local_ip()
    host_id = make_host_id(hostname, ip)
    import platform
    os_name = f"{platform.system()} {platform.release()}"

    print(f"[agent] host      : {hostname}")
    print(f"[agent] ip        : {ip}")
    print(f"[agent] host_id   : {host_id}")
    print(f"[agent] backend   : {args.backend}")
    print(f"[agent] interval  : {args.interval}s")
    print(f"[agent] tekan Ctrl+C untuk berhenti")

    # warm-up psutil cpu_percent agar iterasi pertama valid
    psutil.cpu_percent(interval=None)
    for p in psutil.process_iter():
        try:
            p.cpu_percent(interval=None)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    previous_net = None
    iteration = 0
    while True:
        metrics = collect_metrics(previous_net)
        previous_net = metrics.pop("_net_counters")

        payload = {
            "host_id": host_id,
            "hostname": hostname,
            "ip": ip,
            "os": os_name,
            "domain_hint": os.getenv("AGENT_DOMAIN", ""),
            "ts": datetime.now(timezone.utc).isoformat(),
            "metrics": metrics,
        }

        status, body = send_payload(args.backend, payload)
        iteration += 1
        if status == 200:
            kept = body.get("kept_count", "-") if isinstance(body, dict) else "-"
            print(f"[agent] #{iteration} terkirim | cpu={metrics['cpu_percent']}% "
                  f"ram={metrics['mem_percent']}% disk={metrics['disk_percent']}% "
                  f"net recv={metrics['net_recv_kbps']}KB/s sent={metrics['net_sent_kbps']}KB/s | disimpan backend: {kept}")
        else:
            print(f"[agent] #{iteration} GAGAL kirim: {body}")

        if args.once:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[agent] dihentikan")
