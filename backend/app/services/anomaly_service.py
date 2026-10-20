import pandas as pd

from app.core.config import ATTACK_PREDICTION_FILE, PERFORMANCE_FILE
from app.utils.dataframe import dataframe_to_records


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
    return {"status": "success", "data": dataframe_to_records(df)}


def get_anomaly_log():
    """Log anomali per domain/tipe serangan dari hasil evaluasi model.

    Satu entri log = satu tipe serangan yang terdeteksi model pada test set
    di sebuah domain. Framework dengan skor terbaik (scikit-learn) yang
    dipakai sebagai sumber log.
    """
    if not ATTACK_PREDICTION_FILE.exists():
        return {
            "status": "unavailable",
            "message": "Log anomali belum tersedia. Jalankan ulang notebook evaluasi.",
            "evaluated_at": None,
            "data": [],
        }

    df = pd.read_csv(ATTACK_PREDICTION_FILE)

    if "Framework" in df.columns:
        preferred = df[
            df["Framework"].astype(str).str.lower() == "scikit-learn"
        ]
        if not preferred.empty:
            df = preferred

    df = df[pd.to_numeric(df.get("Predicted_Count"), errors="coerce").fillna(0) > 0]

    evaluated_at = None
    try:
        from datetime import datetime, timezone

        mtime = ATTACK_PREDICTION_FILE.stat().st_mtime
        evaluated_at = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
    except OSError:
        pass

    entries = []
    for _, row in df.iterrows():
        predicted = int(pd.to_numeric(row.get("Predicted_Count"), errors="coerce") or 0)
        severity = "high" if predicted >= 1000 else ("medium" if predicted >= 100 else "low")
        entries.append({
            "Domain": row.get("Domain"),
            "Attack_Type": str(row.get("Attack_Type") or "").upper(),
            "Predicted_Count": predicted,
            "Actual_Count": int(pd.to_numeric(row.get("Actual_Count"), errors="coerce") or 0),
            "Precision": row.get("Precision"),
            "Recall": row.get("Recall"),
            "F1": row.get("F1"),
            "Severity": severity,
        })

    entries.sort(key=lambda e: e["Predicted_Count"], reverse=True)

    return {
        "status": "success",
        "evaluated_at": evaluated_at,
        "data": entries,
    }
