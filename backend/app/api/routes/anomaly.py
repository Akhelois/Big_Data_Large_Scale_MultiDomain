from fastapi import APIRouter

from app.services.anomaly_service import (
    get_anomaly_log,
    get_attack_predictions,
    get_anomaly_summary,
)

router = APIRouter()

@router.get("/")
def anomaly():
    return get_anomaly_summary()


@router.get("/predictions")
def attack_predictions():
    return get_attack_predictions()


@router.get("/log")
def anomaly_log():
    return get_anomaly_log()
