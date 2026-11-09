from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.services import monitoring_service

router = APIRouter()

AGENT_SCRIPT_PATH = Path(__file__).resolve().parents[2] / "assets" / "monitor_agent.py"


class MetricsPayload(BaseModel):
    host_id: str
    hostname: str
    ip: str = ""
    os: str = ""
    domain_hint: str = ""
    ts: str = ""
    metrics: dict = {}


@router.post("/ingest")
def ingest(payload: MetricsPayload):
    """Endpoint untuk PC monitoring agent mengirim snapshot metrik."""
    result = monitoring_service.ingest(payload.model_dump())
    if not result.get("ok"):
        return {"status": "error", "message": result.get("message", "payload tidak valid")}
    return {"status": "success", "kept_count": result.get("kept_count", 0)}


@router.get("/hosts")
def hosts():
    return {"status": "success", "data": monitoring_service.list_hosts()}


@router.get("/history")
def history(host: str, minutes: int = 60):
    """Time-series satu host. Contoh: /api/monitoring/history?host=<host_id>&minutes=60"""
    minutes = max(5, min(minutes, 24 * 60))
    return {"status": "success", "data": monitoring_service.get_history(host, minutes)}


@router.get("/summary")
def summary():
    return {"status": "success", "data": monitoring_service.get_summary()}


@router.get("/correlation")
def correlation(host: str = ""):
    """Heatmap korelasi metrik host (live, dari snapshot monitoring terakhir)."""
    return {
        "status": "success",
        "data": monitoring_service.get_host_correlation(host or None),
    }


@router.get("/anomalies")
def anomalies(limit: int = 50, host: str = ""):
    """Log anomali metrik sistem (CPU/RAM/disk melewati batas, dan pemulihan)."""
    return {
        "status": "success",
        "data": monitoring_service.get_anomalies(limit=limit, host_id=host or None),
    }


@router.get("/agent-script", response_class=PlainTextResponse)
def agent_script():
    """Script agent standalone untuk PC lain.

    Unduh dari PC yang ingin dimonitor:
        curl http://<ip-backend>:8000/api/monitoring/agent-script -o agent.py
        pip install psutil && python agent.py --backend http://<ip-backend>:8000
    """
    return AGENT_SCRIPT_PATH.read_text(encoding="utf-8")


@router.get("/iot/summary")
def iot_summary():
    return {"status": "success", "data": monitoring_service.get_iot_summary()}


@router.get("/iot/devices")
def iot_devices():
    return {"status": "success", "data": monitoring_service.get_iot_devices()}


@router.get("/iot/telemetry")
def iot_telemetry(device: str = "iot_weather", minutes: int = 30):
    return {"status": "success", "data": monitoring_service.get_iot_telemetry(device, minutes)}


@router.get("/iot/anomalies")
def iot_anomalies(limit: int = 20):
    return {"status": "success", "data": monitoring_service.get_iot_anomalies(limit)}


@router.get("/network/summary")
def network_summary():
    return {"status": "success", "data": monitoring_service.get_network_summary()}


@router.get("/network/traffic")
def network_traffic(minutes: int = 30):
    return {"status": "success", "data": monitoring_service.get_network_traffic(minutes)}


@router.get("/network/flows")
def network_flows(limit: int = 25):
    return {"status": "success", "data": monitoring_service.get_network_flows(limit)}


@router.get("/network/threats")
def network_threats(limit: int = 20):
    return {"status": "success", "data": monitoring_service.get_network_threats(limit)}


@router.get("/network/protocols")
def network_protocols():
    return {"status": "success", "data": monitoring_service.get_network_protocols()}

