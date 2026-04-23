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
    compare_model_ids: Optional[str] = None
    code_language: Optional[str] = None
    code_script: Optional[str] = None
    code_output: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None


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
    compare_model_ids: Optional[str] = None
    code_language: Optional[str] = None
    code_script: Optional[str] = None
    code_output: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None


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
    compare_model_ids: Optional[str] = None
    code_language: Optional[str] = None
    code_script: Optional[str] = None
    code_output: Optional[str] = None
    image_gen_prompt: Optional[str] = None
    image_gen_url: Optional[str] = None

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
