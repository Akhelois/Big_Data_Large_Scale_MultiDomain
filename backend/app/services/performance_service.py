from pathlib import Path

import pandas as pd

from app.core.config import PERFORMANCE_FILE


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

    df = df.where(pd.notna(df), None)

    data = df.to_dict(orient="records")

    return {
        "status": "success",
        "data": data,
    }