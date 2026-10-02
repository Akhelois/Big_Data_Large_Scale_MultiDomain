from fastapi import APIRouter

from app.services.performance_service import (
    get_performance,
)

router = APIRouter()

@router.get("/")
def performance():
    return get_performance()