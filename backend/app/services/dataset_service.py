import pandas as pd

from app.core.config import DATASET_SUMMARY_FILE
from app.utils.dataframe import dataframe_to_records

# Normalisasi nama kolom dari CSV (lowercase) ke format yang dipakai dashboard
COLUMN_ALIASES = {
    "domain": "Domain",
    "file": "File",
    "rows_used": "Records",
    "records": "Records",
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(
        columns={
            col: COLUMN_ALIASES.get(str(col).strip().lower(), col)
            for col in df.columns
        }
    )


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
    df = _normalize_columns(df)

    return {
        "status": "success",
        "data": dataframe_to_records(df),
    }
