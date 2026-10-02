from fastapi import APIRouter

from app.services.overview_service import (
    get_overview,
)

router = APIRouter()

@router.get("/")
def overview():
    return get_overview()