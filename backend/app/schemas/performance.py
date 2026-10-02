from typing import Any

from pydantic import BaseModel


class PerformanceResponse(BaseModel):
    status: str
    data: list[dict[str, Any]]