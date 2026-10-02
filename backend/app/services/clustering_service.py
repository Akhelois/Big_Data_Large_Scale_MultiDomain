import pandas as pd

from app.core.config import CLUSTER_SUMMARY_FILE


def get_clustering_summary():
    if not CLUSTER_SUMMARY_FILE.exists():
        return {
            "status": "error",
            "message": (
                "cluster_summary.csv "
                "was not found."
            ),
            "data": [],
        }

    df = pd.read_csv(CLUSTER_SUMMARY_FILE)

    df = df.where(pd.notna(df), None)

    data = df.to_dict(orient="records")

    return {
        "status": "success",
        "data": data,
    }