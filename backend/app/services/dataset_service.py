import pandas as pd

from app.core.config import DATASET_SUMMARY_FILE


def get_dataset_summary():
    if not DATASET_SUMMARY_FILE.exists():
        return {
            "status": "error",
            "message": (
                "dataset_file_summary.csv "
                "was not found."
            ),
            "data": [],
        }

    df = pd.read_csv(DATASET_SUMMARY_FILE)

    df = df.where(pd.notna(df), None)

    data = df.to_dict(orient="records")

    return {
        "status": "success",
        "data": data,
    }