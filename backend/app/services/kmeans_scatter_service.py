"""
K-Means scatter service — data sebaran cluster untuk dashboard.

Membaca model asli (multidomain_scaler.pkl + multidomain_kmeans.pkl) dan dataset
asli di model/dataset/, mereplikasi formula fitur notebook (log1p mean/max/std/sum
dari kolom numerik), lalu memproyeksikan hasil clustering ke 2D via PCA.

Sampling: per domain diambil maksimal SAMPLE_PER_DOMAIN baris dari file dataset
(deterministik, dibaca berurutan) supaya request pertama tidak berat.
Hasil di-cache ke file JSON; request berikutnya membaca cache (instan).
?refresh=1 pada route akan memaksa perhitungan ulang.
"""

import glob
import json
import threading
import time
from pathlib import Path

import numpy as np

from app.core.config import BASE_DIR

MODEL_DIR = BASE_DIR.parent / "model"
MODELS_DIR = MODEL_DIR / "models"
DATASET_DIR = MODEL_DIR / "dataset"
CACHE_PATH = BASE_DIR / "app" / "services" / "kmeans_scatter_cache.json"

SAMPLE_PER_DOMAIN = 20000
PER_FILE_ROWS = 8000
MAX_POINTS_OUT = 1200  # titik per domain yang dikirim ke frontend

DOMAINS = [
    ("Processed_IoT_dataset", "IoT"),
    ("Processed_Linux_dataset", "Linux"),
    ("Processed_Network_dataset", "Network"),
    ("Processed_Windows_dataset", "Windows"),
]

DROP_LIKE = {"ts", "date", "time", "label", "type", "attack_type", "cmd", "pid", "temp_condition"}

_lock = threading.Lock()


def _build_metric_features(files, max_rows):
    """Replikasi formula fitur notebook (cell 8 main.ipynb)."""
    import pandas as pd

    parts = []
    remaining = max_rows
    for f in files:
        if remaining <= 0:
            break
        df = pd.read_csv(f, low_memory=False, nrows=min(PER_FILE_ROWS, remaining))
        drop_like = [c for c in df.columns if c.strip().lower() in DROP_LIKE]
        X = df.drop(columns=drop_like, errors="ignore").select_dtypes(include=[np.number])
        if len(X):
            parts.append(X)
            remaining -= len(X)
    if not parts:
        return None
    X = pd.concat(parts, ignore_index=True)
    Xa = X.abs()
    M = pd.DataFrame({
        "Metric_Activity": np.log1p(Xa.mean(axis=1)),
        "Metric_Peak": np.log1p(Xa.max(axis=1)),
        "Metric_Variation": np.log1p(np.sqrt(Xa.var(axis=1))),
        "Throughput_Metric": np.log1p(Xa.sum(axis=1)),
    }).fillna(0.0).replace([np.inf, -np.inf], 0.0)
    return M


def _compute():
    import joblib
    from sklearn.decomposition import PCA

    sc = joblib.load(MODELS_DIR / "multidomain_scaler.pkl")
    km = joblib.load(MODELS_DIR / "multidomain_kmeans.pkl")
    n_clusters = int(km.n_clusters)

    domains_out = []
    for folder, label in DOMAINS:
        files = sorted(glob.glob(str(DATASET_DIR / folder / "*.csv")))
        M = _build_metric_features(files, SAMPLE_PER_DOMAIN)
        if M is None or len(M) < 10:
            continue
        Z = sc.transform(M)
        labels = km.predict(Z)

        pca = PCA(n_components=2, random_state=42)
        P = pca.fit_transform(Z)
        var = pca.explained_variance_ratio_.tolist()

        # downsample merata untuk payload JSON
        idx = np.linspace(0, len(P) - 1, min(MAX_POINTS_OUT, len(P))).astype(int)
        points = [
            {"x": round(float(P[i, 0]), 3), "y": round(float(P[i, 1]), 3), "cluster": int(labels[i])}
            for i in idx
        ]

        C = pca.transform(km.cluster_centers_)
        centroids = [{"x": round(float(cx), 3), "y": round(float(cy), 3)} for cx, cy in C]

        counts = {int(c): int((labels == c).sum()) for c in np.unique(labels)}
        domains_out.append({
            "domain": label,
            "n": int(len(M)),
            "points": points,
            "centroids": centroids,
            "counts": counts,
            "pca_variance": [round(v * 100, 1) for v in var],
        })

    return {
        "n_clusters": n_clusters,
        "sample_per_domain": SAMPLE_PER_DOMAIN,
        "generated_at": datetime_utc_iso(),
        "domains": domains_out,
    }


def datetime_utc_iso():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


def get_scatter(refresh: bool = False) -> dict:
    """Return data scatter dari cache (atau hitung baru). Thread-safe."""
    with _lock:
        if not refresh and CACHE_PATH.exists():
            try:
                cached = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
                if cached.get("domains"):
                    return cached
            except (json.JSONDecodeError, OSError):
                pass
        data = _compute()
        try:
            CACHE_PATH.write_text(json.dumps(data), encoding="utf-8")
        except OSError:
            pass
        return data
