import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BASE_DIR / ".env")

MODEL_DIR = Path(
    os.getenv("MODEL_DIR", "../model")
)

if not MODEL_DIR.is_absolute():
    MODEL_DIR = (BASE_DIR / MODEL_DIR).resolve()

FRONTEND_URL = os.getenv(
    "FRONTEND_URL",
    "http://localhost:5173"
)

CLUSTER_SUMMARY_FILE = (
    MODEL_DIR / "cluster_summary.csv"
)

DATASET_SUMMARY_FILE = (
    MODEL_DIR / "dataset_file_summary.csv"
)

PERFORMANCE_FILE = (
    MODEL_DIR / "domain_model_evaluation.csv"
)

MODEL_SUMMARY_FILE = (
    MODEL_DIR / "model_summary.csv"
)

MODEL_METADATA_FILE = (
    MODEL_DIR / "model_metadata.json"
)

NEO4J_URI = os.getenv("NEO4J_URI", "")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")

ATTACK_PREDICTION_FILE = MODEL_DIR / "anomaly_type_prediction_summary.csv"
