from fastapi import APIRouter

from app.services.dataset_service import (
    get_dataset_summary,
)

router = APIRouter()

@router.get("/")
def dataset():
    return get_dataset_summary()