from fastapi import APIRouter

from app.services.clustering_service import (
    get_clustering_summary,
)

router = APIRouter()

@router.get("/")
def clustering():
    return get_clustering_summary()