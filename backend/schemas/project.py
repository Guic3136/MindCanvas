from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from schemas.common import PaginatedResponse


class ProjectCreate(BaseModel):
    name: str


class ProjectUpdate(BaseModel):
    name: str


class NodeBrief(BaseModel):
    id: int
    model_id: int
    node_type: str
    label: str
    position_x: float
    position_y: float
    width: float
    height: float
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    web_url: Optional[str] = None
    web_content: Optional[str] = None
    note_content: Optional[str] = None
    transform_prompt: Optional[str] = None
    transform_output: Optional[str] = None
    transform_format: Optional[str] = None
    merge_strategy: Optional[str] = None
    self_critique: Optional[bool] = None
    max_iterations: Optional[int] = None
    batch_mode: Optional[bool] = None
    routing_rules: Optional[str] = None
    transform_route: Optional[str] = None
    compare_model_ids: Optional[str] = None
    code_language: Optional[str] = None
    code_script: Optional[str] = None
    code_output: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None

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
