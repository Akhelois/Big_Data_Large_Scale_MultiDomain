import pandas as pd

from app.core.config import (
    DATASET_SUMMARY_FILE,
    PERFORMANCE_FILE,
    CLUSTER_SUMMARY_FILE,
)
from app.utils.dataframe import dataframe_to_records


def get_overview():
    total_records = 0
    total_files = 0
    domains = 0
    average_f1 = 0
    selected_k = None

    dataset_data = []

    if DATASET_SUMMARY_FILE.exists():
        dataset_df = pd.read_csv(
            DATASET_SUMMARY_FILE
        )

        dataset_data = dataframe_to_records(dataset_df)

        if "Records" in dataset_df.columns:
            total_records = int(
                pd.to_numeric(
                    dataset_df["Records"],
                    errors="coerce"
                ).fillna(0).sum()
            )

        if "Domain" in dataset_df.columns:
            domains = int(
                dataset_df["Domain"].nunique()
            )

        if "File" in dataset_df.columns:
            total_files = int(
                dataset_df["File"].nunique()
            )

    if PERFORMANCE_FILE.exists():
        performance_df = pd.read_csv(
            PERFORMANCE_FILE
        )

        if "F1" in performance_df.columns:
            multidomain_rows = (
                performance_df["Domain"].astype(str).str.lower() == "multidomain"
                if "Domain" in performance_df.columns
                else pd.Series(False, index=performance_df.index)
            )
            f1_source = performance_df.loc[multidomain_rows, "F1"] if multidomain_rows.any() else performance_df["F1"]
            f1 = pd.to_numeric(f1_source, errors="coerce").dropna()

            if not f1.empty:
                average_f1 = float(f1.mean())

        if "Best_K" in performance_df.columns:
            k_values = pd.to_numeric(
                performance_df["Best_K"],
                errors="coerce"
            ).dropna()

            if not k_values.empty:
                selected_k = int(
                    k_values.mode().iloc[0]
                )

    if CLUSTER_SUMMARY_FILE.exists():
        cluster_df = pd.read_csv(
            CLUSTER_SUMMARY_FILE
        )

        if (
            selected_k is None
            and "cluster" in cluster_df.columns
        ):
            selected_k = int(
                cluster_df["cluster"].nunique()
            )

    return {
        "status": "success",
        "data": {
            "totalRecords": total_records,
            "totalFiles": total_files,
            "domains": domains,
            "averageF1": average_f1,
            "selectedK": selected_k,
        },
    }
