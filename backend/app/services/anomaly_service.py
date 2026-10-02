import pandas as pd

from app.core.config import ATTACK_PREDICTION_FILE, PERFORMANCE_FILE


def get_anomaly_summary():
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

    result = []

    for _, row in df.iterrows():
        item = {}

        for column in df.columns:
            value = row[column]

            if pd.isna(value):
                value = None

            item[column] = value

        result.append(item)

    return {
        "status": "success",
        "data": result,
    }


def get_attack_predictions():
    if not ATTACK_PREDICTION_FILE.exists():
        return {
            "status": "unavailable",
            "message": "Prediksi per jenis serangan belum tersedia. Jalankan ulang model/main.ipynb terlebih dahulu.",
            "data": [],
        }

    df = pd.read_csv(ATTACK_PREDICTION_FILE)
    df = df.where(pd.notna(df), None)
    return {"status": "success", "data": df.to_dict(orient="records")}
