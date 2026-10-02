from typing import Any

from pydantic import BaseModel


class AnomalyResponse(BaseModel):
    status: str
    data: list[dict[str, Any]]