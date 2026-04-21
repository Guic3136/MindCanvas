from pydantic import BaseModel
from typing import Optional, List


class NodeCreate(BaseModel):
    model_id: int
    label: str = "新节点"
    position_x: float = 0
    position_y: float = 0


class NodeUpdate(BaseModel):
    model_id: Optional[int] = None
    label: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None


class NodeResponse(BaseModel):
    id: int
    project_id: int
    model_id: int
    label: str
    position_x: float
    position_y: float
    width: float
    height: float

    class Config:
        from_attributes = True


class EdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    context_mode: str = "full_history"


class EdgeUpdate(BaseModel):
    context_mode: str


class EdgeResponse(BaseModel):
    id: int
    project_id: int
    source_node_id: int
    target_node_id: int
    context_mode: str

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    node_id: int
    role: str
    content: str

    class Config:
        from_attributes = True
