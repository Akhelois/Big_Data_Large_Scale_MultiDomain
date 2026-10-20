from fastapi import APIRouter

from app.services.clustering_service import (
    get_clustering_summary,
)
from app.services import kmeans_scatter_service

router = APIRouter()

@router.get("/")
def clustering():
    return get_clustering_summary()


@router.get("/scatter")
def kmeans_scatter(refresh: int = 0):
    """Sebaran cluster K-Means (proyeksi PCA 2D) per domain untuk scatter chart.

    Hasil di-cache; kirim ?refresh=1 untuk menghitung ulang dari dataset.
    """
    try:
        data = kmeans_scatter_service.get_scatter(refresh=bool(refresh))
        return {"status": "success", "data": data}
    except FileNotFoundError as exc:
        return {"status": "error", "message": f"Model artefak tidak ditemukan: {exc}"}
    except Exception as exc:  # jangan biarkan dashboard mati
        return {"status": "error", "message": f"Gagal menghitung scatter: {type(exc).__name__}"}