from pathlib import Path

import pandas as pd

from app.core.config import PERFORMANCE_FILE
from app.utils.dataframe import dataframe_to_records


def get_performance():
    if not PERFORMANCE_FILE.exists():
        return {
            "status": "error",
            "message": (
                "domain_model_evaluation.csv "
                "was not found."
            ),
            "data": [],
        }

    df = pd.read_csv(PERFORMANCE_FILE)

    return {
        "status": "success",
        "data": dataframe_to_records(df),
    }