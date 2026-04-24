from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from core.database import Base
from core.security import encrypt_value, decrypt_value


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")


class ModelProvider(Base):
    __tablename__ = "model_providers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    base_url = Column(String(500), nullable=False)
    _api_key = Column("api_key_encrypted", String(500), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    models = relationship("Model", back_populates="provider", cascade="all, delete-orphan")

    @property
    def api_key(self) -> str:
        return decrypt_value(self._api_key)

    @api_key.setter
    def api_key(self, value: str):
        self._api_key = encrypt_value(value)


class Model(Base):
    __tablename__ = "models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider_id = Column(Integer, ForeignKey("model_providers.id"), nullable=False, index=True)
    model_id = Column(String(200), nullable=False)
    display_name = Column(String(200), nullable=False)
    is_enabled = Column(Boolean, default=True)
    supports_vision = Column(Boolean, default=False)

    provider = relationship("ModelProvider", back_populates="models")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(300), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="projects")
    nodes = relationship("Node", back_populates="project", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="project", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    # === 通用字段 ===
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False, index=True)
    node_type = Column(String(30), nullable=False, default="chat")
    label = Column(String(300), nullable=False, default="新节点")
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    width = Column(Float, default=400)
    height = Column(Float, default=500)

    # === file 类型专属 ===
    file_url = Column(String(500))
    file_name = Column(String(200))
    file_type = Column(String(50))

    # === web 类型专属 ===
    web_url = Column(String(1000))
    web_content = Column(Text)

    # === note 类型专属 ===
    note_content = Column(Text)

    # === transform 类型专属 ===
    transform_prompt = Column(Text)
    transform_output = Column(Text)
    transform_format = Column(String(20), default="text")
    merge_strategy = Column(String(20), default="concat")
    self_critique = Column(Boolean, default=False)
    max_iterations = Column(Integer, default=3)

    # === compare 类型专属 ===
    compare_model_ids = Column(String(500))

    # === code 类型专属 ===
    code_language = Column(String(20))
    code_script = Column(Text)
    code_output = Column(Text)

    # === image_gen 类型专属 ===
    image_gen_prompt = Column(Text)
    image_gen_url = Column(String(500))

    # === transform 扩展 ===
    batch_mode = Column(Boolean, default=False)
    routing_rules = Column(Text)
    transform_route = Column(String(20))

    project = relationship("Project", back_populates="nodes")
    model = relationship("Model")
    messages = relationship("Message", back_populates="node", cascade="all, delete-orphan", order_by="Message.created_at")


class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    source_node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False, index=True)
    target_node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False, index=True)
    context_mode = Column(String(50), default="full_history")
    route_tag = Column(String(20))

    __table_args__ = (
        UniqueConstraint('project_id', 'source_node_id', 'target_node_id', name='uq_edge_source_target'),
        CheckConstraint("context_mode IN ('full_history', 'last_reply')", name='chk_edge_context_mode'),
    )

    project = relationship("Project", back_populates="edges")
    source_node = relationship("Node", foreign_keys=[source_node_id])
    target_node = relationship("Node", foreign_keys=[target_node_id])


class ImageGenConfig(Base):
    __tablename__ = "image_gen_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False, default="default")
    base_url = Column(String(500), nullable=False, default="https://dashscope.aliyuncs.com/api/v1")
    model_id = Column(String(200), nullable=False, default="qwen-image-2.0-pro")
    _api_key = Column("api_key_encrypted", String(500), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @property
    def api_key(self) -> str:
        return decrypt_value(self._api_key)

    @api_key.setter
    def api_key(self, value: str):
        self._api_key = encrypt_value(value)


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'assistant')", name='chk_message_role'),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    node = relationship("Node", back_populates="messages")
