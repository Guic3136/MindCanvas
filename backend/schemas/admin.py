from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from datetime import datetime
from schemas.common import PaginatedResponse


class ProviderCreate(BaseModel):
    name: str
    base_url: str
    api_key: str


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None


class ProviderResponse(BaseModel):
    id: int
    name: str
    base_url: str
    api_key_masked: str
    created_at: datetime

    class Config:
        from_attributes = True


class ModelCreate(BaseModel):
    provider_id: int
    model_id: str
    display_name: str


class ModelUpdate(BaseModel):
    model_id: Optional[str] = None
    display_name: Optional[str] = None
    is_enabled: Optional[bool] = None


class ModelResponse(BaseModel):
    id: int
    provider_id: int
    model_id: str
    display_name: str
    is_enabled: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str


class UserListResponse(BaseModel):
    id: int
    username: str
    is_admin: bool
    created_at: datetime

    class Config:
        from_attributes = True
