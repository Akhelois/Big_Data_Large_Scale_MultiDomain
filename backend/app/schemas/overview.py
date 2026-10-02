from typing import Optional

from pydantic import BaseModel


class OverviewData(BaseModel):
    totalRecords: int
    totalFiles: int
    domains: int
    averageF1: float
    selectedK: Optional[int]