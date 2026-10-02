from typing import Any

from pydantic import BaseModel


class DatasetResponse(BaseModel):
    status: str
    data: list[dict[str, Any]]