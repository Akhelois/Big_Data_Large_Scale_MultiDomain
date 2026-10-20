from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import FRONTEND_URL
from app.services import agent_service, discovery_service

from app.api.routes.overview import router as overview_router
from app.api.routes.dataset import router as dataset_router
from app.api.routes.performance import router as performance_router
from app.api.routes.anomaly import router as anomaly_router
from app.api.routes.clustering import router as clustering_router
from app.api.routes.neo4j import router as neo4j_router
from app.api.routes.monitoring import router as monitoring_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Jalankan monitoring agent (backend memonitor dirinya sendiri)
    # dan network discovery (deteksi perangkat lain di jaringan lokal)
    agent_service.start()
    discovery_service.start()
    yield
    discovery_service.stop()
    agent_service.stop()


app = FastAPI(
    title="Multidomain Analytics API",
    description="API for multidomain analytics dashboard",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    overview_router,
    prefix="/api/overview",
    tags=["Overview"],
)

app.include_router(
    dataset_router,
    prefix="/api/dataset",
    tags=["Dataset"],
)

app.include_router(
    performance_router,
    prefix="/api/performance",
    tags=["Performance"],
)

app.include_router(
    anomaly_router,
    prefix="/api/anomaly",
    tags=["Anomaly Detection"],
)

app.include_router(
    clustering_router,
    prefix="/api/clustering",
    tags=["Clustering"],
)

app.include_router(neo4j_router, prefix="/api/neo4j", tags=["Neo4j Analytics"])

app.include_router(monitoring_router, prefix="/api/monitoring", tags=["PC Monitoring"])


@app.get("/")
def root():
    return {
        "message": "Multidomain Analytics API",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
    }
