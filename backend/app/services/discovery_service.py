"""
Network discovery service — mendeteksi perangkat lain di jaringan lokal.

Backend melakukan ping sweep + TCP probe terhadap subnet /24 tempat ia
berjalan. Perangkat yang merespons didaftarkan ke tabel hosts sebagai
host "discovered" (tanpa metrik agent — hanya status reachable).

Kontrol lewat environment variable:
    DISCOVERY           : "1" (default, aktif) atau "0" untuk mematikan
    DISCOVERY_INTERVAL  : jeda antar scan dalam detik (default 300)
"""

import hashlib
import ipaddress
import os
import platform
import socket
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from app.services import monitoring_service

try:
    from app.services.agent_service import get_local_ip
except ImportError:
    get_local_ip = None

_enabled = os.getenv("DISCOVERY", "1").strip().lower() not in ("0", "false", "no")
_interval = max(60.0, float(os.getenv("DISCOVERY_INTERVAL", "300") or 300))

_common_ports = (22, 80, 135, 139, 443, 445, 3389, 515, 631, 8080, 9100)

_thread: threading.Thread | None = None
_stop = threading.Event()


def _ping(ip: str) -> bool:
    """ICMP ping satu paket (cepat, tanpa menunggu lama)."""
    param = "-n" if platform.system().lower() == "windows" else "-c"
    wait = "-w" if platform.system().lower() == "windows" else "-W"
    timeout = "800" if platform.system().lower() == "windows" else "1"
    cmd = ["ping", param, "1", wait, timeout, ip]
    try:
        return subprocess.run(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3
        ).returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return False


def _tcp_reachable(ip: str) -> bool:
    """Perangkat yang blok ICMP sering tetap membuka port umum."""
    for port in _common_ports:
        try:
            s = socket.create_connection((ip, port), timeout=0.4)
            s.close()
            return True
        except OSError:
            continue
    return False


def _probe(ip: str) -> str | None:
    if _ping(ip) or _tcp_reachable(ip):
        return ip
    return None


def _resolve_hostname(ip: str) -> str | None:
    """Reverse DNS — boleh gagal, fallback ke nama generik."""
    try:
        name = socket.gethostbyaddr(ip)[0]
        return name.split(".")[0] if name else None
    except (socket.herror, socket.gaierror, OSError):
        return None


def scan_once() -> int:
    """Scan subnet /24 dari IP backend. Return jumlah perangkat ditemukan."""
    if get_local_ip is None:
        return 0
    my_ip = get_local_ip()
    try:
        network = ipaddress.ip_network(f"{my_ip}/24", strict=False)
    except ValueError:
        return 0

    targets = [str(h) for h in network.hosts() if str(h) != my_ip]
    with ThreadPoolExecutor(max_workers=64) as ex:
        alive = [ip for ip in ex.map(_probe, targets) if ip]

    with ThreadPoolExecutor(max_workers=32) as ex:
        names = list(ex.map(_resolve_hostname, alive))

    found = 0
    for ip, name in zip(alive, names):
        monitoring_service.register_discovered_host(ip, name)
        found += 1
    print(f"[discovery] {found} perangkat ditemukan di {network} (termasuk host agent)")
    return found


def _loop():
    while not _stop.is_set():
        try:
            scan_once()
        except Exception as exc:  # jangan pernah matikan thread backend
            print(f"[discovery] error: {exc}")
        _stop.wait(_interval)


def start():
    """Jalankan network discovery sebagai daemon thread. Aman dipanggil berulang."""
    global _thread
    if not _enabled:
        print("[discovery] dinonaktifkan lewat DISCOVERY=0")
        return
    if get_local_ip is None:
        print("[discovery] agent_service tidak tersedia — dilewati")
        return
    if _thread and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(target=_loop, daemon=True, name="network-discovery")
    _thread.start()


def stop():
    _stop.set()
