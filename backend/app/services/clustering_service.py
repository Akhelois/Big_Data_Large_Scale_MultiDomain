import pandas as pd

from app.core.config import CLUSTER_SUMMARY_FILE
from app.utils.dataframe import dataframe_to_records


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

    return {
        "status": "success",
        "data": dataframe_to_records(df),
    }