from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: str


class NodeBrief(BaseModel):
    id: int
    model_id: int
    label: str
    position_x: float
    position_y: float
    width: float
    height: float

    class Config:
        from_attributes = True


class EdgeBrief(BaseModel):
    id: int
    source_node_id: int
    target_node_id: int
    context_mode: str

    class Config:
        from_attributes = True


class ProjectResponse(BaseModel):
    id: int
    name: str
    owner_id: int
    created_at: datetime
    updated_at: datetime
    nodes: List[NodeBrief] = []
    edges: List[EdgeBrief] = []

    class Config:
        from_attributes = True


class ProjectListItem(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
