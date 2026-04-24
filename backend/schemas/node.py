from pydantic import BaseModel
from typing import Optional, List


class NodeCreate(BaseModel):
    model_id: int
    node_type: str = "chat"
    label: str = "新节点"
    position_x: float = 0
    position_y: float = 0
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
    compare_model_ids: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None
    batch_mode: Optional[bool] = None
    routing_rules: Optional[str] = None


class NodeUpdate(BaseModel):
    model_id: Optional[int] = None
    node_type: Optional[str] = None
    label: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
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
    compare_model_ids: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None
    batch_mode: Optional[bool] = None
    routing_rules: Optional[str] = None


class NodeResponse(BaseModel):
    id: int
    project_id: int
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
    compare_model_ids: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None
    batch_mode: Optional[bool] = None
    routing_rules: Optional[str] = None
    transform_route: Optional[str] = None

    class Config:
        from_attributes = True


class EdgeCreate(BaseModel):
    source_node_id: int
    target_node_id: int
    context_mode: str = "full_history"
    route_tag: Optional[str] = None


class EdgeUpdate(BaseModel):
    context_mode: str
    route_tag: Optional[str] = None


class EdgeResponse(BaseModel):
    id: int
    project_id: int
    source_node_id: int
    target_node_id: int
    context_mode: str
    route_tag: Optional[str] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: int
    node_id: int
    role: str
    content: str

    class Config:
        from_attributes = True
