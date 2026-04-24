from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class ImageGenConfigResponse(BaseModel):
    id: int
    name: str
    base_url: str
    model_id: str
    api_key_masked: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImageGenConfigUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    model_id: str | None = None
    api_key: str | None = None
