from typing import Any

from pydantic import BaseModel


class ClusteringResponse(BaseModel):
    status: str
    data: list[dict[str, Any]]