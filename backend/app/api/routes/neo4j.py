from fastapi import APIRouter

from app.services.neo4j_service import get_neo4j_analytics

router = APIRouter()


@router.get("/analytics")
def neo4j_analytics():
    return get_neo4j_analytics()
