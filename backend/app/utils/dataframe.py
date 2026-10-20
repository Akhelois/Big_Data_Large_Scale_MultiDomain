from typing import Any

import numpy as np
import pandas as pd


def dataframe_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert a DataFrame to JSON-safe dicts.

    NaN and +/-Infinity cannot be serialized by Starlette's JSONResponse
    (allow_nan=False), so they are replaced with None (null in JSON).
    """
    cleaned = df.replace([np.inf, -np.inf], np.nan)
    cleaned = cleaned.astype(object).where(pd.notna(cleaned), None)
    return cleaned.to_dict(orient="records")
