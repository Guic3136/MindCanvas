# MindCanvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visual AI prompt debugging canvas tool where users drag-and-drop chat nodes on a canvas, wire them to establish context dependencies, iterate on prompts, and export the final workflow as a Markdown document.

**Architecture:** React 19 + React Flow frontend with FastAPI backend. Backend proxies all LLM API calls (SSE streaming) so API keys never reach the browser. SQLite for persistence. Docker Compose for deployment.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS 4, React Flow, Zustand, FastAPI, SQLAlchemy 2.0 async, aiosqlite, openai SDK (for multi-provider LLM calls), cryptography (Fernet), Docker Compose

---

## File Structure

```
MindCanvas/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Canvas/
│   │   │   │   ├── FlowCanvas.tsx
│   │   │   │   ├── ChatNode.tsx
│   │   │   │   ├── ChatNodeHeader.tsx
│   │   │   │   ├── ChatNodeMessages.tsx
│   │   │   │   ├── ChatNodeInput.tsx
│   │   │   │   ├── CustomEdge.tsx
│   │   │   │   └── CanvasToolbar.tsx
│   │   │   ├── AdminPanel/
│   │   │   │   ├── AdminLayout.tsx
│   │   │   │   ├── ModelProviders.tsx
│   │   │   │   ├── ModelList.tsx
│   │   │   │   └── UserManagement.tsx
│   │   │   ├── ExportPanel/
│   │   │   │   └── ExportButton.tsx
│   │   │   ├── ProjectList/
│   │   │   │   └── ProjectList.tsx
│   │   │   └── Auth/
│   │   │       └── LoginPage.tsx
│   │   ├── stores/
│   │   │   ├── canvasStore.ts
│   │   │   ├── chatStore.ts
│   │   │   └── authStore.ts
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── auth.ts
│   │   │   ├── project.ts
│   │   │   ├── chat.ts
│   │   │   └── admin.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
├── backend/
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── projects.py
│   │   ├── nodes.py
│   │   ├── admin.py
│   │   └── export.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_client.py
│   │   ├── context_builder.py
│   │   └── markdown_exporter.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── db.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── project.py
│   │   ├── node.py
│   │   └── admin.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── security.py
│   │   └── database.py
│   ├── main.py
│   └── requirements.txt
├── docker-compose.yml
└── docs/
```

---

## Task 1: Backend Project Scaffolding

**Files:**
- Create: `backend/core/__init__.py`
- Create: `backend/core/config.py`
- Create: `backend/core/database.py`
- Create: `backend/core/security.py`
- Create: `backend/models/__init__.py`
- Create: `backend/models/db.py`
- Create: `backend/routers/__init__.py`
- Create: `backend/services/__init__.py`
- Create: `backend/schemas/__init__.py`
- Create: `backend/main.py`
- Create: `backend/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```txt
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
aiosqlite==0.20.0
pydantic==2.10.4
pydantic-settings==2.7.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
cryptography==44.0.0
openai==1.58.1
python-multipart==0.0.20
```

- [ ] **Step 2: Create core/config.py**

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "MindCanvas"
    database_url: str = "sqlite+aiosqlite:///./mindcanvas.db"
    secret_key: str = "change-me-in-production-min-32-chars-long"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    encryption_key: str = "change-me-in-production-min-32-chars-long"
    encryption_salt: str = "mindcanvas-salt"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 3: Create core/database.py**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from .config import get_settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(get_settings().database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

- [ ] **Step 4: Create core/security.py**

```python
import base64
from datetime import datetime, timedelta, timezone
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from jose import jwt
from passlib.context import CryptContext
from .config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Fernet encryption for API keys
settings = get_settings()
kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=settings.encryption_salt.encode(),
    iterations=100_000,
)
_fernet_key = base64.urlsafe_b64encode(kdf.derive(settings.encryption_key.encode()))
_fernet = Fernet(_fernet_key)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def encrypt_value(value: str) -> str:
    return base64.urlsafe_b64encode(_fernet.encrypt(value.encode())).decode()


def decrypt_value(encrypted: str) -> str:
    return _fernet.decrypt(base64.urlsafe_b64decode(encrypted)).decode()


def mask_secret(secret: str, visible_chars: int = 4) -> str:
    if len(secret) <= visible_chars:
        return "***"
    return "*" * (len(secret) - visible_chars) + secret[-visible_chars:]
```

- [ ] **Step 5: Create models/db.py — all SQLAlchemy models**

```python
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from ..core.database import Base
from ..core.security import encrypt_value, decrypt_value


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
    provider_id = Column(Integer, ForeignKey("model_providers.id"), nullable=False)
    model_id = Column(String(200), nullable=False)
    display_name = Column(String(200), nullable=False)
    is_enabled = Column(Boolean, default=True)

    provider = relationship("ModelProvider", back_populates="models")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(300), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="projects")
    nodes = relationship("Node", back_populates="project", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="project", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False)
    label = Column(String(300), nullable=False, default="新节点")
    position_x = Column(Float, default=0)
    position_y = Column(Float, default=0)
    width = Column(Float, default=400)
    height = Column(Float, default=500)

    project = relationship("Project", back_populates="nodes")
    model = relationship("Model")
    messages = relationship("Message", back_populates="node", cascade="all, delete-orphan", order_by="Message.created_at")


class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    source_node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    target_node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    context_mode = Column(String(50), default="full_history")  # "full_history" | "last_reply"

    project = relationship("Project", back_populates="edges")
    source_node = relationship("Node", foreign_keys=[source_node_id])
    target_node = relationship("Node", foreign_keys=[target_node_id])


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" | "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    node = relationship("Node", back_populates="messages")
```

- [ ] **Step 6: Create main.py**

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import get_settings
from .core.database import init_db
from .routers import auth, projects, nodes, admin, export


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(nodes.router)
app.include_router(admin.router)
app.include_router(export.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Verify backend starts**

Run: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload`
Expected: Server starts on port 8000, `/api/health` returns `{"status":"ok"}`, `/docs` shows Swagger UI

- [ ] **Step 8: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend project with config, database, models, security"
```

---

## Task 2: Auth Router + Schemas

**Files:**
- Create: `backend/schemas/auth.py`
- Create: `backend/routers/auth.py`

- [ ] **Step 1: Create schemas/auth.py**

```python
from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Create routers/auth.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from ..core.config import get_settings
from ..core.database import get_db
from ..core.security import verify_password, create_access_token
from ..models.db import User
from ..schemas.auth import LoginRequest, LoginResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(credentials.credentials, get_settings().secret_key, algorithms=[get_settings().algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.get(User, int(user_id))
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token({"sub": str(user.id)})
    return LoginResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
```

- [ ] **Step 3: Create a seed script to create an initial admin user**

Create: `backend/seed.py`

```python
import asyncio
from core.database import init_db, async_session
from core.security import hash_password
from models.db import User


async def seed():
    await init_db()
    async with async_session() as db:
        admin = User(username="admin", password_hash=hash_password("admin123"), is_admin=True)
        db.add(admin)
        await db.commit()
        print("Admin user created: admin / admin123")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 4: Verify auth endpoints**

Run: `cd backend && python seed.py` to create admin user
Then: `curl -X POST http://localhost:8000/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}'`
Expected: `{"access_token":"eyJ...","token_type":"bearer"}`

- [ ] **Step 5: Commit**

```bash
git add backend/schemas/auth.py backend/routers/auth.py backend/seed.py
git commit -m "feat: add auth router with JWT login and current user endpoint"
```

---

## Task 3: Admin Router (Model Providers, Models, Users)

**Files:**
- Create: `backend/schemas/admin.py`
- Create: `backend/routers/admin.py`

- [ ] **Step 1: Create schemas/admin.py**

```python
from pydantic import BaseModel
from datetime import datetime


class ProviderCreate(BaseModel):
    name: str
    base_url: str
    api_key: str


class ProviderUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    api_key: str | None = None


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
    model_id: str | None = None
    display_name: str | None = None
    is_enabled: bool | None = None


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
```

- [ ] **Step 2: Create routers/admin.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_db
from ..core.security import hash_password, mask_secret
from ..models.db import User, ModelProvider, Model
from ..schemas.admin import (
    ProviderCreate, ProviderUpdate, ProviderResponse,
    ModelCreate, ModelUpdate, ModelResponse,
    UserCreate, UserListResponse,
)
from .auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# --- Provider CRUD ---

@router.get("/providers", response_model=list[ProviderResponse])
async def list_providers(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(ModelProvider).order_by(ModelProvider.id))
    providers = result.scalars().all()
    return [
        ProviderResponse(
            id=p.id, name=p.name, base_url=p.base_url,
            api_key_masked=mask_secret(p.api_key), created_at=p.created_at,
        )
        for p in providers
    ]


@router.post("/providers", response_model=ProviderResponse)
async def create_provider(req: ProviderCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    provider = ModelProvider(name=req.name, base_url=req.base_url)
    provider.api_key = req.api_key
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return ProviderResponse(
        id=provider.id, name=provider.name, base_url=provider.base_url,
        api_key_masked=mask_secret(provider.api_key), created_at=provider.created_at,
    )


@router.put("/providers/{pid}", response_model=ProviderResponse)
async def update_provider(pid: int, req: ProviderUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    provider = await db.get(ModelProvider, pid)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    if req.name is not None:
        provider.name = req.name
    if req.base_url is not None:
        provider.base_url = req.base_url
    if req.api_key is not None:
        provider.api_key = req.api_key
    await db.commit()
    await db.refresh(provider)
    return ProviderResponse(
        id=provider.id, name=provider.name, base_url=provider.base_url,
        api_key_masked=mask_secret(provider.api_key), created_at=provider.created_at,
    )


@router.delete("/providers/{pid}")
async def delete_provider(pid: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    provider = await db.get(ModelProvider, pid)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    await db.delete(provider)
    await db.commit()
    return {"ok": True}


# --- Model CRUD ---

@router.get("/models", response_model=list[ModelResponse])
async def list_models(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(Model).order_by(Model.id))
    return result.scalars().all()


@router.post("/models", response_model=ModelResponse)
async def create_model(req: ModelCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    provider = await db.get(ModelProvider, req.provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    model = Model(provider_id=req.provider_id, model_id=req.model_id, display_name=req.display_name)
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


@router.put("/models/{mid}", response_model=ModelResponse)
async def update_model(mid: int, req: ModelUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    model = await db.get(Model, mid)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    if req.model_id is not None:
        model.model_id = req.model_id
    if req.display_name is not None:
        model.display_name = req.display_name
    if req.is_enabled is not None:
        model.is_enabled = req.is_enabled
    await db.commit()
    await db.refresh(model)
    return model


@router.delete("/models/{mid}")
async def delete_model(mid: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    model = await db.get(Model, mid)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    await db.delete(model)
    await db.commit()
    return {"ok": True}


# --- User Management ---

@router.get("/users", response_model=list[UserListResponse])
async def list_users(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


@router.post("/users", response_model=UserListResponse)
async def create_user(req: UserCreate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    existing = await db.execute(select(User).where(User.username == req.username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(username=req.username, password_hash=hash_password(req.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/users/{uid}")
async def delete_user(uid: int, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Verify admin endpoints**

Run backend, login to get token, then:
```
curl http://localhost:8000/api/admin/providers -H "Authorization: Bearer <token>"
curl -X POST http://localhost:8000/api/admin/providers -H "Authorization: Bearer <token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"DashScope","base_url":"https://dashscope.aliyuncs.com/compatible-mode/v1","api_key":"sk-test123"}'
```
Expected: Provider created with masked API key in response

- [ ] **Step 4: Commit**

```bash
git add backend/schemas/admin.py backend/routers/admin.py
git commit -m "feat: add admin router for providers, models, and user management"
```

---

## Task 4: Project & Node & Edge CRUD

**Files:**
- Create: `backend/schemas/project.py`
- Create: `backend/schemas/node.py`
- Create: `backend/routers/projects.py`
- Create: `backend/routers/nodes.py`

- [ ] **Step 1: Create schemas/project.py**

```python
from pydantic import BaseModel
from datetime import datetime


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
    nodes: list[NodeBrief] = []
    edges: list[EdgeBrief] = []

    class Config:
        from_attributes = True


class ProjectListItem(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

- [ ] **Step 2: Create schemas/node.py**

```python
from pydantic import BaseModel


class NodeCreate(BaseModel):
    model_id: int
    label: str = "新节点"
    position_x: float = 0
    position_y: float = 0


class NodeUpdate(BaseModel):
    model_id: int | None = None
    label: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    width: float | None = None
    height: float | None = None


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
```

- [ ] **Step 3: Create routers/projects.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from ..core.database import get_db
from ..models.db import Project, User
from ..schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem, NodeBrief, EdgeBrief
from .auth import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectListItem])
async def list_projects(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Project).where(Project.owner_id == current_user.id).order_by(Project.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(name=req.name, owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{pid}", response_model=ProjectResponse)
async def get_project(pid: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.owner_id == current_user.id).options(selectinload(Project.nodes), selectinload(Project.edges))
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{pid}", response_model=ProjectResponse)
async def update_project(pid: int, req: ProjectUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).where(Project.id == pid, Project.owner_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = req.name
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{pid}")
async def delete_project(pid: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).where(Project.id == pid, Project.owner_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 4: Create routers/nodes.py (nodes + edges CRUD, no chat yet)**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_db
from ..models.db import Project, Node, Edge, Message, User
from ..schemas.node import (
    NodeCreate, NodeUpdate, NodeResponse,
    EdgeCreate, EdgeUpdate, EdgeResponse,
    MessageResponse,
)
from .auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}", tags=["nodes"])


async def _get_project(project_id: int, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


# --- Nodes ---

@router.post("/nodes", response_model=NodeResponse)
async def create_node(project_id: int, req: NodeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    node = Node(project_id=project_id, model_id=req.model_id, label=req.label, position_x=req.position_x, position_y=req.position_y)
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.put("/nodes/{nid}", response_model=NodeResponse)
async def update_node(project_id: int, nid: int, req: NodeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(node, field, value)
    await db.commit()
    await db.refresh(node)
    return node


@router.delete("/nodes/{nid}")
async def delete_node(project_id: int, nid: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")
    await db.delete(node)
    await db.commit()
    return {"ok": True}


@router.get("/nodes/{nid}/messages", response_model=list[MessageResponse])
async def get_messages(project_id: int, nid: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")
    result = await db.execute(select(Message).where(Message.node_id == nid).order_by(Message.created_at))
    return result.scalars().all()


# --- Edges ---

@router.post("/edges", response_model=EdgeResponse)
async def create_edge(project_id: int, req: EdgeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    edge = Edge(project_id=project_id, source_node_id=req.source_node_id, target_node_id=req.target_node_id, context_mode=req.context_mode)
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


@router.put("/edges/{eid}", response_model=EdgeResponse)
async def update_edge(project_id: int, eid: int, req: EdgeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    edge = await db.get(Edge, eid)
    if not edge or edge.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edge not found")
    edge.context_mode = req.context_mode
    await db.commit()
    await db.refresh(edge)
    return edge


@router.delete("/edges/{eid}")
async def delete_edge(project_id: int, eid: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    edge = await db.get(Edge, eid)
    if not edge or edge.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edge not found")
    await db.delete(edge)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 5: Verify CRUD endpoints**

Test via Swagger UI at `/docs`:
1. Create a project
2. Create a node in that project
3. Create an edge between two nodes
4. GET project detail — verify nodes and edges are included
5. Delete node — verify cascade deletes its edges and messages

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/project.py backend/schemas/node.py backend/routers/projects.py backend/routers/nodes.py
git commit -m "feat: add project, node, and edge CRUD endpoints"
```

---

## Task 5: LLM Client + Context Builder + Chat Endpoint (SSE)

**Files:**
- Create: `backend/services/llm_client.py`
- Create: `backend/services/context_builder.py`
- Modify: `backend/routers/nodes.py` (add chat endpoint)

- [ ] **Step 1: Create services/llm_client.py**

```python
import openai
from typing import AsyncGenerator


async def stream_chat(
    base_url: str,
    api_key: str,
    model_id: str,
    messages: list[dict],
) -> AsyncGenerator[str, None]:
    """Stream chat completion tokens from any OpenAI-compatible API."""
    client = openai.AsyncOpenAI(base_url=base_url, api_key=api_key, timeout=120.0)
    stream = await client.chat.completions.create(
        model=model_id,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

- [ ] **Step 2: Create services/context_builder.py**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.db import Node, Edge, Message


async def build_context_messages(target_node_id: int, db: AsyncSession) -> list[dict]:
    """Build context messages from upstream nodes for the target node."""
    # Get all edges targeting this node
    result = await db.execute(
        select(Edge).where(Edge.target_node_id == target_node_id).order_by(Edge.id)
    )
    edges = result.scalars().all()

    if not edges:
        return []

    context_messages = []
    for edge in edges:
        # Get source node info
        source_node = await db.get(Node, edge.source_node_id)
        if not source_node:
            continue

        # Get messages from source node
        if edge.context_mode == "full_history":
            msg_result = await db.execute(
                select(Message).where(Message.node_id == edge.source_node_id).order_by(Message.created_at)
            )
            source_messages = msg_result.scalars().all()
        else:  # last_reply
            msg_result = await db.execute(
                select(Message).where(Message.node_id == edge.source_node_id, Message.role == "assistant").order_by(Message.created_at.desc())
            )
            last_msg = msg_result.scalars().first()
            source_messages = [last_msg] if last_msg else []

        if source_messages:
            context_messages.append({
                "role": "user",
                "content": f'[来自"{source_node.label}"的上下文]\n' + "\n\n".join(
                    f"{'用户' if m.role == 'user' else '助手'}: {m.content}" for m in source_messages
                ),
            })

    return context_messages
```

- [ ] **Step 3: Add chat endpoint to routers/nodes.py**

Append to the existing `routers/nodes.py`:

```python
import json
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import selectinload
from ..services.llm_client import stream_chat
from ..services.context_builder import build_context_messages


@router.post("/nodes/{nid}/chat")
async def chat(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)

    # Get node with model info
    result = await db.execute(
        select(Node).where(Node.id == nid, Node.project_id == project_id).options(selectinload(Node.model).selectinload(Model.provider))
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    user_message = body.get("message", "")
    if not user_message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Save user message
    msg_user = Message(node_id=nid, role="user", content=user_message)
    db.add(msg_user)
    await db.commit()
    await db.refresh(msg_user)

    # Build context from upstream nodes
    context = await build_context_messages(nid, db)

    # Get current node's own history
    history_result = await db.execute(
        select(Message).where(Message.node_id == nid).order_by(Message.created_at)
    )
    history = history_result.scalars().all()

    # Assemble messages: context + node history
    messages = context + [{"role": m.role, "content": m.content} for m in history]

    # Provider config
    provider = node.model.provider
    model_id = node.model.model_id
    base_url = provider.base_url
    api_key = provider.api_key

    # SSE streaming response
    async def event_generator():
        collected = []
        async for token in stream_chat(base_url, api_key, model_id, messages):
            collected.append(token)
            yield f"data: {json.dumps({'type': 'token', 'content': token}, ensure_ascii=False)}\n\n"

        # Save complete assistant message
        full_content = "".join(collected)
        async with async_session() as save_db:
            msg_assistant = Message(node_id=nid, role="assistant", content=full_content)
            save_db.add(msg_assistant)
            await save_db.commit()
            await save_db.refresh(msg_assistant)
            yield f"data: {json.dumps({'type': 'done', 'message_id': msg_assistant.id}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Note: Import `async_session` from `..core.database` and `Model` from `..models.db` at the top of the file.

- [ ] **Step 4: Verify chat endpoint**

1. Create provider + model via admin API
2. Create project + node with that model
3. POST to `/api/projects/1/nodes/1/chat` with `{"message": "Hello, what model are you?"}`
4. Verify SSE stream returns tokens

- [ ] **Step 5: Commit**

```bash
git add backend/services/llm_client.py backend/services/context_builder.py backend/routers/nodes.py
git commit -m "feat: add LLM client, context builder, and SSE chat endpoint"
```

---

## Task 6: Export to Markdown

**Files:**
- Create: `backend/services/markdown_exporter.py`
- Create: `backend/routers/export.py`

- [ ] **Step 1: Create services/markdown_exporter.py**

```python
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.db import Project, Node, Edge, Message


async def export_project_markdown(project_id: int, db: AsyncSession) -> str:
    """Export a project as a structured Markdown document."""
    # Load project
    project = await db.get(Project, project_id)
    if not project:
        return "# Error: Project not found"

    # Load nodes
    nodes_result = await db.execute(select(Node).where(Node.project_id == project_id).order_by(Node.id))
    nodes = {n.id: n for n in nodes_result.scalars().all()}

    # Load edges
    edges_result = await db.execute(select(Edge).where(Edge.project_id == project_id).order_by(Edge.id))
    edges = edges_result.scalars().all()

    # Build adjacency for dependency info
    incoming: dict[int, list[Edge]] = {}
    for e in edges:
        incoming.setdefault(e.target_node_id, []).append(e)

    lines = []
    lines.append(f"# {project.name}")
    lines.append("")
    lines.append(f"> 导出时间：{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}")
    lines.append("")

    # Flow overview
    lines.append("## 流程概览")
    lines.append("")
    if edges:
        for e in edges:
            src = nodes.get(e.source_node_id)
            tgt = nodes.get(e.target_node_id)
            if src and tgt:
                lines.append(f"- {src.label} → {tgt.label}")
    else:
        lines.append("（无连线，各节点独立）")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Each node
    for node in nodes.values():
        model = await db.get(node.model.__class__, node.model_id)
        provider = await db.get(model.provider.__class__, model.provider_id) if model else None
        model_display = f"{model.display_name} ({provider.name})" if model and provider else "未知模型"

        deps = incoming.get(node.id, [])
        dep_labels = []
        for d in deps:
            src = nodes.get(d.source_node_id)
            mode_text = "全部对话历史" if d.context_mode == "full_history" else "仅最后回复"
            if src:
                dep_labels.append(f"{src.label}（{mode_text}）")

        lines.append(f"## {node.label}")
        lines.append("")
        lines.append(f"**模型：** {model_display}")
        if dep_labels:
            lines.append(f"**上下文来源：** {', '.join(dep_labels)}")
        lines.append("")

        # Messages
        msg_result = await db.execute(
            select(Message).where(Message.node_id == node.id).order_by(Message.created_at)
        )
        messages = msg_result.scalars().all()
        if messages:
            lines.append("### 对话")
            lines.append("")
            for m in messages:
                role_label = "**用户：**" if m.role == "user" else "**助手：**"
                lines.append(f"{role_label} {m.content}")
                lines.append("")
        else:
            lines.append("（暂无对话）")
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)
```

- [ ] **Step 2: Create routers/export.py**

```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from ..core.database import get_db
from ..models.db import User
from .auth import get_current_user
from .projects import _get_project
from ..services.markdown_exporter import export_project_markdown

router = APIRouter(tags=["export"])


@router.post("/api/projects/{project_id}/export", response_class=PlainTextResponse)
async def export_markdown(project_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await _get_project(project_id, user, db)
    content = await export_project_markdown(project_id, db)
    return PlainTextResponse(content, headers={"Content-Disposition": f'attachment; filename="project-{project_id}.md"'})
```

Note: The `_get_project` function needs to be imported from `routers.projects`. If circular import issues arise, extract it to a shared dependency module.

- [ ] **Step 3: Verify export**

1. Create project with nodes and messages
2. POST to `/api/projects/1/export`
3. Verify returned Markdown matches expected format

- [ ] **Step 4: Commit**

```bash
git add backend/services/markdown_exporter.py backend/routers/export.py
git commit -m "feat: add Markdown export service and endpoint"
```

---

## Task 7: Frontend Project Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mindcanvas-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.1.0",
    "@xyflow/react": "^12.4.0",
    "zustand": "^5.0.0",
    "axios": "^1.7.0",
    "lucide-react": "^0.469.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 4: Create index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MindCanvas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 6: Create src/index.css**

```css
@import "tailwindcss";

html, body, #root {
  height: 100%;
  margin: 0;
}
```

- [ ] **Step 7: Create src/types/index.ts**

```typescript
export interface User {
  id: number
  username: string
  is_admin: boolean
}

export interface ModelProvider {
  id: number
  name: string
  base_url: string
  api_key_masked: string
  created_at: string
}

export interface ModelInfo {
  id: number
  provider_id: number
  model_id: string
  display_name: string
  is_enabled: boolean
}

export interface Project {
  id: number
  name: string
  owner_id: number
  created_at: string
  updated_at: string
  nodes: NodeInfo[]
  edges: EdgeInfo[]
}

export interface ProjectListItem {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface NodeInfo {
  id: number
  model_id: number
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
}

export interface EdgeInfo {
  id: number
  source_node_id: number
  target_node_id: number
  context_mode: string
}

export interface MessageInfo {
  id: number
  node_id: number
  role: string
  content: string
}
```

- [ ] **Step 8: Create src/api/client.ts**

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api
```

- [ ] **Step 9: Install dependencies and verify frontend starts**

Run: `cd frontend && npm install && npm run dev`
Expected: Vite dev server starts on port 5173

- [ ] **Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold frontend with React, Vite, TailwindCSS, React Flow"
```

---

## Task 8: Auth Store + Login Page

**Files:**
- Create: `frontend/src/stores/authStore.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/components/Auth/LoginPage.tsx`

- [ ] **Step 1: Create stores/authStore.ts**

```typescript
import { create } from 'zustand'
import type { User } from '@/types'
import * as authApi from '@/api/auth'

interface AuthState {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  login: async (username, password) => {
    const { data } = await authApi.login(username, password)
    localStorage.setItem('token', data.access_token)
    const user = await authApi.getMe()
    set({ user })
  },
  logout: () => {
    localStorage.removeItem('token')
    set({ user: null })
  },
  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ loading: false })
      return
    }
    try {
      const user = await authApi.getMe()
      set({ user, loading: false })
    } catch {
      localStorage.removeItem('token')
      set({ loading: false })
    }
  },
}))
```

- [ ] **Step 2: Create api/auth.ts**

```typescript
import api from './client'
import type { User } from '@/types'

export async function login(username: string, password: string) {
  return api.post<{ access_token: string; token_type: string }>('/auth/login', { username, password })
}

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/auth/me')
  return data
}
```

- [ ] **Step 3: Create components/Auth/LoginPage.tsx**

```tsx
import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(username, password)
    } catch {
      setError('用户名或密码错误')
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <form onSubmit={handleSubmit} className="bg-gray-900 p-8 rounded-lg shadow-xl w-80 space-y-4">
        <h1 className="text-2xl font-bold text-center text-white">MindCanvas</h1>
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 outline-none"
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-blue-500 outline-none"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
        >
          登录
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Create App.tsx with routing**

```tsx
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import LoginPage from '@/components/Auth/LoginPage'

function App() {
  const { user, loading, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-gray-950 text-white">加载中...</div>
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div className="flex items-center justify-center h-screen bg-gray-950 text-white">MindCanvas - 登录成功，画布开发中...</div>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 5: Verify login flow**

1. Start backend + frontend
2. Navigate to http://localhost:5173
3. See login form
4. Enter admin/admin123
5. See "登录成功" placeholder

- [ ] **Step 6: Commit**

```bash
git add frontend/src/stores/authStore.ts frontend/src/api/auth.ts frontend/src/components/Auth/LoginPage.tsx frontend/src/App.tsx
git commit -m "feat: add auth store, login page, and routing"
```

---

## Task 9: Project List Page

**Files:**
- Create: `frontend/src/api/project.ts`
- Create: `frontend/src/components/ProjectList/ProjectList.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create api/project.ts**

```typescript
import api from './client'
import type { Project, ProjectListItem } from '@/types'

export async function listProjects(): Promise<ProjectListItem[]> {
  const { data } = await api.get<ProjectListItem[]>('/projects')
  return data
}

export async function createProject(name: string): Promise<Project> {
  const { data } = await api.post<Project>('/projects', { name })
  return data
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${id}`)
  return data
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`)
}
```

- [ ] **Step 2: Create components/ProjectList/ProjectList.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import * as projectApi from '@/api/project'
import type { ProjectListItem } from '@/types'

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    const list = await projectApi.listProjects()
    setProjects(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    const name = prompt('项目名称：')
    if (!name) return
    const project = await projectApi.createProject(name)
    navigate(`/canvas/${project.id}`)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此项目？')) return
    await projectApi.deleteProject(id)
    load()
  }

  if (loading) return <div className="text-gray-400 p-8">加载中...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">MindCanvas</h1>
          <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">
            <Plus size={18} /> 新建项目
          </button>
        </div>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-center mt-20">还没有项目，点击上方创建一个</p>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/canvas/${p.id}`)}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <div>
                  <h2 className="text-lg font-medium">{p.name}</h2>
                  <p className="text-sm text-gray-500">{new Date(p.updated_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                  className="p-2 text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx to add project list route**

Add the route for `/` pointing to `ProjectList` and add a route for `/canvas/:id` (placeholder for now):

```tsx
import ProjectList from '@/components/ProjectList/ProjectList'

// In Routes:
<Route path="/" element={<ProjectList />} />
<Route path="/canvas/:id" element={<div className="flex items-center justify-center h-screen bg-gray-950 text-white">画布页面开发中...</div>} />
```

- [ ] **Step 4: Verify project list**

1. Login
2. See project list page
3. Create a new project → navigates to canvas placeholder
4. Go back → see project in list
5. Delete a project

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/project.ts frontend/src/components/ProjectList/ProjectList.tsx frontend/src/App.tsx
git commit -m "feat: add project list page with create/delete"
```

---

## Task 10: Canvas Store + API (nodes, edges, chat with SSE)

**Files:**
- Create: `frontend/src/stores/canvasStore.ts`
- Create: `frontend/src/stores/chatStore.ts`
- Create: `frontend/src/api/chat.ts`

- [ ] **Step 1: Create api/chat.ts**

```typescript
import api from './client'
import type { NodeInfo, EdgeInfo, MessageInfo } from '@/types'

export async function createNode(projectId: number, data: { model_id: number; label?: string; position_x?: number; position_y?: number }): Promise<NodeInfo> {
  const { data: result } = await api.post<NodeInfo>(`/projects/${projectId}/nodes`, data)
  return result
}

export async function updateNode(projectId: number, nodeId: number, data: Partial<NodeInfo>): Promise<NodeInfo> {
  const { data: result } = await api.put<NodeInfo>(`/projects/${projectId}/nodes/${nodeId}`, data)
  return result
}

export async function deleteNode(projectId: number, nodeId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/nodes/${nodeId}`)
}

export async function getMessages(projectId: number, nodeId: number): Promise<MessageInfo[]> {
  const { data } = await api.get<MessageInfo[]>(`/projects/${projectId}/nodes/${nodeId}/messages`)
  return data
}

export async function createEdge(projectId: number, data: { source_node_id: number; target_node_id: number; context_mode?: string }): Promise<EdgeInfo> {
  const { data: result } = await api.post<EdgeInfo>(`/projects/${projectId}/edges`, data)
  return result
}

export async function updateEdge(projectId: number, edgeId: number, data: { context_mode: string }): Promise<EdgeInfo> {
  const { data: result } = await api.put<EdgeInfo>(`/projects/${projectId}/edges/${edgeId}`, data)
  return result
}

export async function deleteEdge(projectId: number, edgeId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/edges/${edgeId}`)
}

export function chatStream(projectId: number, nodeId: number, message: string, onToken: (token: string) => void, onDone: (messageId: number) => void, onError: (error: string) => void) {
  const token = localStorage.getItem('token')
  const controller = new AbortController()

  fetch(`/api/projects/${projectId}/nodes/${nodeId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text()
      onError(text)
      return
    }
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) return

    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') onToken(data.content)
            if (data.type === 'done') onDone(data.message_id)
            if (data.type === 'error') onError(data.error)
          } catch {}
        }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message)
  })

  return { cancel: () => controller.abort() }
}
```

- [ ] **Step 2: Create stores/chatStore.ts**

```typescript
import { create } from 'zustand'
import type { MessageInfo } from '@/types'
import * as chatApi from '@/api/chat'

interface ChatState {
  messages: Record<number, MessageInfo[]>  // nodeId -> messages
  streaming: Record<number, string>        // nodeId -> current streaming content
  loading: Record<number, boolean>

  loadMessages: (projectId: number, nodeId: number) => Promise<void>
  sendMessage: (projectId: number, nodeId: number, message: string) => void
  clearStreaming: (nodeId: number) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  streaming: {},
  loading: {},

  loadMessages: async (projectId, nodeId) => {
    set((s) => ({ loading: { ...s.loading, [nodeId]: true } }))
    const msgs = await chatApi.getMessages(projectId, nodeId)
    set((s) => ({
      messages: { ...s.messages, [nodeId]: msgs },
      loading: { ...s.loading, [nodeId]: false },
    }))
  },

  sendMessage: (projectId, nodeId, message) => {
    // Optimistically add user message
    const tempUserMsg: MessageInfo = { id: Date.now(), node_id: nodeId, role: 'user', content: message }
    set((s) => ({
      messages: { ...s.messages, [nodeId]: [...(s.messages[nodeId] || []), tempUserMsg] },
      streaming: { ...s.streaming, [nodeId]: '' },
    }))

    chatApi.chatStream(
      projectId,
      nodeId,
      message,
      // onToken
      (token) => {
        set((s) => ({
          streaming: { ...s.streaming, [nodeId]: (s.streaming[nodeId] || '') + token },
        }))
      },
      // onDone
      () => {
        // Reload messages from server to get persisted assistant message
        get().loadMessages(projectId, nodeId)
        set((s) => {
          const newStreaming = { ...s.streaming }
          delete newStreaming[nodeId]
          return { streaming: newStreaming }
        })
      },
      // onError
      (error) => {
        console.error('Chat error:', error)
        set((s) => {
          const newStreaming = { ...s.streaming }
          delete newStreaming[nodeId]
          return { streaming: newStreaming }
        })
      },
    )
  },

  clearStreaming: (nodeId) => {
    set((s) => {
      const newStreaming = { ...s.streaming }
      delete newStreaming[nodeId]
      return { streaming: newStreaming }
    })
  },
}))
```

- [ ] **Step 3: Create stores/canvasStore.ts**

```typescript
import { create } from 'zustand'
import type { Project, NodeInfo, EdgeInfo, ModelInfo } from '@/types'
import * as projectApi from '@/api/project'
import * as chatApi from '@/api/chat'

interface CanvasState {
  project: Project | null
  models: ModelInfo[]
  loading: boolean

  loadProject: (id: number) => Promise<void>
  loadModels: () => Promise<void>
  addNode: (modelId: number, position: { x: number; y: number }) => Promise<void>
  updateNodePosition: (nodeId: number, position: { x: number; y: number }) => void
  updateNodeLabel: (nodeId: number, label: string) => Promise<void>
  updateNodeModel: (nodeId: number, modelId: number) => Promise<void>
  removeNode: (nodeId: number) => Promise<void>
  addEdge: (sourceId: number, targetId: number) => Promise<void>
  updateEdgeMode: (edgeId: number, contextMode: string) => Promise<void>
  removeEdge: (edgeId: number) => Promise<void>
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  project: null,
  models: [],
  loading: true,

  loadProject: async (id) => {
    set({ loading: true })
    const project = await projectApi.getProject(id)
    set({ project, loading: false })
  },

  loadModels: async () => {
    const { data } = await (await import('@/api/client')).default.get<ModelInfo[]>('/admin/models')
    set({ models: data.filter((m) => m.is_enabled) })
  },

  addNode: async (modelId, position) => {
    const { project } = get()
    if (!project) return
    const node = await chatApi.createNode(project.id, {
      model_id: modelId,
      label: `节点 ${(project.nodes?.length || 0) + 1}`,
      position_x: position.x,
      position_y: position.y,
    })
    set((s) => ({
      project: s.project ? { ...s.project, nodes: [...s.project.nodes, node] } : null,
    }))
  },

  updateNodePosition: (nodeId, position) => {
    const { project } = get()
    if (!project) return
    chatApi.updateNode(project.id, nodeId, { position_x: position.x, position_y: position.y })
    set((s) => ({
      project: s.project ? {
        ...s.project,
        nodes: s.project.nodes.map((n) => n.id === nodeId ? { ...n, position_x: position.x, position_y: position.y } : n),
      } : null,
    }))
  },

  updateNodeLabel: async (nodeId, label) => {
    const { project } = get()
    if (!project) return
    await chatApi.updateNode(project.id, nodeId, { label })
    set((s) => ({
      project: s.project ? {
        ...s.project,
        nodes: s.project.nodes.map((n) => n.id === nodeId ? { ...n, label } : n),
      } : null,
    }))
  },

  updateNodeModel: async (nodeId, modelId) => {
    const { project } = get()
    if (!project) return
    await chatApi.updateNode(project.id, nodeId, { model_id: modelId })
    set((s) => ({
      project: s.project ? {
        ...s.project,
        nodes: s.project.nodes.map((n) => n.id === nodeId ? { ...n, model_id: modelId } : n),
      } : null,
    }))
  },

  removeNode: async (nodeId) => {
    const { project } = get()
    if (!project) return
    await chatApi.deleteNode(project.id, nodeId)
    set((s) => ({
      project: s.project ? {
        ...s.project,
        nodes: s.project.nodes.filter((n) => n.id !== nodeId),
        edges: s.project.edges.filter((e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId),
      } : null,
    }))
  },

  addEdge: async (sourceId, targetId) => {
    const { project } = get()
    if (!project) return
    const edge = await chatApi.createEdge(project.id, { source_node_id: sourceId, target_node_id: targetId })
    set((s) => ({
      project: s.project ? { ...s.project, edges: [...s.project.edges, edge] } : null,
    }))
  },

  updateEdgeMode: async (edgeId, contextMode) => {
    const { project } = get()
    if (!project) return
    await chatApi.updateEdge(project.id, edgeId, { context_mode: contextMode })
    set((s) => ({
      project: s.project ? {
        ...s.project,
        edges: s.project.edges.map((e) => e.id === edgeId ? { ...e, context_mode: contextMode } : e),
      } : null,
    }))
  },

  removeEdge: async (edgeId) => {
    const { project } = get()
    if (!project) return
    await chatApi.deleteEdge(project.id, project.edges.find((e) => e.id === edgeId)!.id)
    set((s) => ({
      project: s.project ? { ...s.project, edges: s.project.edges.filter((e) => e.id !== edgeId) } : null,
    }))
  },
}))
```

- [ ] **Step 4: Verify stores compile**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/canvasStore.ts frontend/src/stores/chatStore.ts frontend/src/api/chat.ts
git commit -m "feat: add canvas store, chat store, and chat API with SSE streaming"
```

---

## Task 11: ChatNode Component (React Flow custom node)

**Files:**
- Create: `frontend/src/components/Canvas/ChatNodeHeader.tsx`
- Create: `frontend/src/components/Canvas/ChatNodeMessages.tsx`
- Create: `frontend/src/components/Canvas/ChatNodeInput.tsx`
- Create: `frontend/src/components/Canvas/ChatNode.tsx`

- [ ] **Step 1: Create ChatNodeHeader.tsx**

```tsx
import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Pencil, Check } from 'lucide-react'
import type { ModelInfo } from '@/types'

interface Props {
  label: string
  modelId: number
  models: ModelInfo[]
  onLabelChange: (label: string) => void
  onModelChange: (modelId: number) => void
}

export default function ChatNodeHeader({ label, modelId, models, onLabelChange, onModelChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)

  const handleLabelSubmit = () => {
    setEditing(false)
    if (editLabel.trim() && editLabel !== label) {
      onLabelChange(editLabel.trim())
    }
  }

  return (
    <div className="flex items-center gap-2 p-3 border-b border-gray-700 bg-gray-800/50">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-gray-900" />
      <select
        value={modelId}
        onChange={(e) => onModelChange(Number(e.target.value))}
        className="flex-1 bg-gray-700 text-white text-sm rounded px-2 py-1 outline-none"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLabelSubmit()}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-24 outline-none"
            autoFocus
          />
          <button onClick={handleLabelSubmit} className="text-green-400 hover:text-green-300">
            <Check size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => { setEditLabel(label); setEditing(true) }} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
          {label} <Pencil size={12} />
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-green-500 !border-2 !border-gray-900" />
    </div>
  )
}
```

- [ ] **Step 2: Create ChatNodeMessages.tsx**

```tsx
import { useEffect, useRef } from 'react'
import type { MessageInfo } from '@/types'

interface Props {
  messages: MessageInfo[]
  streaming: string
}

export default function ChatNodeMessages({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming])

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            m.role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-100'
          }`}>
            {m.content}
          </div>
        </div>
      ))}
      {streaming && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-700 text-gray-100 whitespace-pre-wrap">
            {streaming}
            <span className="inline-block w-1.5 h-4 bg-gray-400 animate-pulse ml-0.5 align-text-bottom" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 3: Create ChatNodeInput.tsx**

```tsx
import { useState } from 'react'
import { Send } from 'lucide-react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
}

export default function ChatNodeInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')

  const handleSend = () => {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
  }

  return (
    <div className="p-3 border-t border-gray-700 flex gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
        placeholder="输入消息..."
        rows={2}
        className="flex-1 bg-gray-800 text-white text-sm rounded px-3 py-2 resize-none outline-none border border-gray-700 focus:border-blue-500"
        disabled={disabled}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        className="self-end p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded"
      >
        <Send size={18} />
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Create ChatNode.tsx**

```tsx
import { useEffect } from 'react'
import { NodeProps } from '@xyflow/react'
import ChatNodeHeader from './ChatNodeHeader'
import ChatNodeMessages from './ChatNodeMessages'
import ChatNodeInput from './ChatNodeInput'
import { useCanvasStore } from '@/stores/canvasStore'
import { useChatStore } from '@/stores/chatStore'

interface ChatNodeData {
  label: string
  model_id: number
  db_node_id: number
  project_id: number
}

export default function ChatNode({ data, selected }: NodeProps) {
  const { label, model_id, db_node_id, project_id } = data as ChatNodeData
  const { models, updateNodeLabel, updateNodeModel } = useCanvasStore()
  const { messages, streaming, loadMessages, sendMessage } = useChatStore()

  const nodeMessages = messages[db_node_id] || []
  const nodeStreaming = streaming[db_node_id] || ''
  const isStreaming = db_node_id in streaming

  useEffect(() => {
    loadMessages(project_id, db_node_id)
  }, [db_node_id, project_id, loadMessages])

  return (
    <div
      className={`bg-gray-900 border rounded-lg shadow-xl flex flex-col ${selected ? 'border-blue-500' : 'border-gray-700'}`}
      style={{ width: 400, height: 500 }}
    >
      <ChatNodeHeader
        label={label}
        modelId={model_id}
        models={models}
        onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
        onModelChange={(newModelId) => updateNodeModel(db_node_id, newModelId)}
      />
      <ChatNodeMessages messages={nodeMessages} streaming={nodeStreaming} />
      <ChatNodeInput
        onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
        disabled={isStreaming}
      />
    </div>
  )
}
```

- [ ] **Step 5: Verify ChatNode renders**

Add a temporary test in App.tsx to render a ChatNode outside React Flow to check the component structure compiles and looks right.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Canvas/ChatNodeHeader.tsx frontend/src/components/Canvas/ChatNodeMessages.tsx frontend/src/components/Canvas/ChatNodeInput.tsx frontend/src/components/Canvas/ChatNode.tsx
git commit -m "feat: add ChatNode component with header, messages, and input"
```

---

## Task 12: FlowCanvas (React Flow integration)

**Files:**
- Create: `frontend/src/components/Canvas/CustomEdge.tsx`
- Create: `frontend/src/components/Canvas/CanvasToolbar.tsx`
- Create: `frontend/src/components/Canvas/FlowCanvas.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create CustomEdge.tsx**

```tsx
import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import { useState } from 'react'
import { X, Settings } from 'lucide-react'

interface CustomEdgeData {
  context_mode: string
  db_edge_id: number
  onModeChange: (edgeId: number, mode: string) => void
  onRemove: (edgeId: number) => void
}

export default function CustomEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const [showMenu, setShowMenu] = useState(false)
  const edgeData = data as unknown as CustomEdgeData

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{ stroke: selected ? '#3b82f6' : '#6b7280', strokeWidth: selected ? 2 : 1.5 }}
        markerEnd="url(#arrow)"
      />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          className="nodrag nopan"
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="bg-gray-800 border border-gray-600 rounded-full p-1 text-gray-400 hover:text-white hover:border-gray-400"
          >
            <Settings size={12} />
          </button>
          {showMenu && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 space-y-1 z-50 min-w-32">
              <button
                onClick={() => { edgeData.onModeChange(edgeData.db_edge_id, 'full_history'); setShowMenu(false) }}
                className={`block w-full text-left text-xs px-2 py-1 rounded ${edgeData.context_mode === 'full_history' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                整条历史
              </button>
              <button
                onClick={() => { edgeData.onModeChange(edgeData.db_edge_id, 'last_reply'); setShowMenu(false) }}
                className={`block w-full text-left text-xs px-2 py-1 rounded ${edgeData.context_mode === 'last_reply' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                仅最后回复
              </button>
              <hr className="border-gray-600" />
              <button
                onClick={() => { edgeData.onRemove(edgeData.db_edge_id); setShowMenu(false) }}
                className="block w-full text-left text-xs px-2 py-1 rounded text-red-400 hover:bg-gray-700 flex items-center gap-1"
              >
                <X size={12} /> 删除连线
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
```

Note: Add SVG arrow marker definition in FlowCanvas or a shared component.

- [ ] **Step 2: Create CanvasToolbar.tsx**

```tsx
import { Plus, Download } from 'lucide-react'

interface Props {
  projectName: string
  onAddNode: () => void
  onExport: () => void
  onProjectNameChange: (name: string) => void
}

export default function CanvasToolbar({ projectName, onAddNode, onExport, onProjectNameChange }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/90 border-b border-gray-700 backdrop-blur">
      <div className="flex items-center gap-3">
        <a href="/" className="text-white font-bold text-lg hover:text-blue-400">MindCanvas</a>
        <span className="text-gray-500">/</span>
        <input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onBlur={(e) => onProjectNameChange(e.target.value)}
          className="bg-transparent text-white text-sm font-medium outline-none border-b border-transparent focus:border-blue-500 px-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onAddNode} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
          <Plus size={16} /> 新建节点
        </button>
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded">
          <Download size={16} /> 导出
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create FlowCanvas.tsx**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useParams } from 'react-router-dom'
import ChatNode from './ChatNode'
import CustomEdge from './CustomEdge'
import CanvasToolbar from './CanvasToolbar'
import { useCanvasStore } from '@/stores/canvasStore'
import * as chatApi from '@/api/chat'
import * as projectApi from '@/api/project'

const nodeTypes = { chat: ChatNode }
const edgeTypes = { custom: CustomEdge }

function FlowCanvasInner() {
  const { id: projectIdStr } = useParams()
  const projectId = Number(projectIdStr)
  const { project, models, loadProject, loadModels, addNode, updateNodePosition, addEdge: addDbEdge, updateEdgeMode, removeEdge: removeDbEdge } = useCanvasStore()

  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    loadProject(projectId)
    loadModels()
  }, [projectId, loadProject, loadModels])

  useEffect(() => {
    if (project) setProjectName(project.name)
  }, [project])

  // Convert DB nodes to React Flow nodes
  const rfNodes: Node[] = useMemo(() => {
    if (!project) return []
    return project.nodes.map((n) => ({
      id: String(n.id),
      type: 'chat',
      position: { x: n.position_x, y: n.position_y },
      data: { label: n.label, model_id: n.model_id, db_node_id: n.id, project_id: projectId },
    }))
  }, [project, projectId])

  // Convert DB edges to React Flow edges
  const rfEdges: Edge[] = useMemo(() => {
    if (!project) return []
    return project.edges.map((e) => ({
      id: String(e.id),
      source: String(e.source_node_id),
      target: String(e.target_node_id),
      type: 'custom',
      data: {
        context_mode: e.context_mode,
        db_edge_id: e.id,
        onModeChange: (edgeId: number, mode: string) => updateEdgeMode(edgeId, mode),
        onRemove: (edgeId: number) => removeDbEdge(edgeId),
      },
    }))
  }, [project, updateEdgeMode, removeDbEdge])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync when project changes
  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    addDbEdge(Number(connection.source), Number(connection.target))
  }, [addDbEdge])

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    updateNodePosition(Number(node.id), node.position)
  }, [updateNodePosition])

  const handleAddNode = useCallback(() => {
    if (models.length === 0) {
      alert('请先在管理员页面添加模型')
      return
    }
    const center = { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 }
    addNode(models[0].id, center)
  }, [models, addNode])

  const handleExport = useCallback(async () => {
    const { data } = await (await import('@//api/client')).default.post(`/projects/${projectId}/export`, {}, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([data], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'project'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [projectId, projectName])

  const handleNameChange = useCallback(async (name: string) => {
    setProjectName(name)
    if (name.trim()) {
      await projectApi.getProject(projectId).then(() => {})
      // Update via API
      const api = (await import('@//api/client')).default
      await api.put(`/projects/${projectId}`, { name: name.trim() })
    }
  }, [projectId])

  if (!project) {
    return <div className="flex items-center justify-center h-screen bg-gray-950 text-white">加载中...</div>
  }

  return (
    <div className="h-screen w-screen">
      <CanvasToolbar
        projectName={projectName}
        onAddNode={handleAddNode}
        onExport={handleExport}
        onProjectNameChange={handleNameChange}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-gray-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700 [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-white [&>button:hover]:!bg-gray-700" />
        <MiniMap nodeColor="#3b82f6" maskColor="rgba(0,0,0,0.8)" className="!bg-gray-900 !border-gray-700" />
        <svg>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
    </div>
  )
}

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  )
}
```

Note: The `handleNameChange` function has an async import issue. Fix it to use a direct import:

```typescript
import api from '@/api/client'

const handleNameChange = useCallback(async (name: string) => {
  setProjectName(name)
  if (name.trim()) {
    await api.put(`/projects/${projectId}`, { name: name.trim() })
  }
}, [projectId])
```

- [ ] **Step 4: Update App.tsx with canvas route**

```tsx
import FlowCanvas from '@/components/Canvas/FlowCanvas'

// In Routes:
<Route path="/canvas/:id" element={<FlowCanvas />} />
```

- [ ] **Step 5: Verify full canvas flow**

1. Login → project list → create project → opens canvas
2. Click "新建节点" → node appears on canvas
3. Create second node → drag from first node's right handle to second node's left handle → edge appears
4. Type message in first node → see streaming response
5. Type message in second node → verify it receives context from first node
6. Click edge settings → change to "仅最后回复"
7. Send message again → verify context changed
8. Click "导出" → download Markdown file

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Canvas/CustomEdge.tsx frontend/src/components/Canvas/CanvasToolbar.tsx frontend/src/components/Canvas/FlowCanvas.tsx frontend/src/App.tsx
git commit -m "feat: add FlowCanvas with React Flow integration, toolbar, and custom edge"
```

---

## Task 13: Admin Panel

**Files:**
- Create: `frontend/src/api/admin.ts`
- Create: `frontend/src/components/AdminPanel/AdminLayout.tsx`
- Create: `frontend/src/components/AdminPanel/ModelProviders.tsx`
- Create: `frontend/src/components/AdminPanel/UserManagement.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create api/admin.ts**

```typescript
import api from './client'
import type { ModelProvider, ModelInfo } from '@/types'

export async function listProviders(): Promise<ModelProvider[]> {
  const { data } = await api.get<ModelProvider[]>('/admin/providers')
  return data
}

export async function createProvider(data: { name: string; base_url: string; api_key: string }): Promise<ModelProvider> {
  const { data: result } = await api.post<ModelProvider>('/admin/providers', data)
  return result
}

export async function updateProvider(id: number, data: { name?: string; base_url?: string; api_key?: string }): Promise<ModelProvider> {
  const { data: result } = await api.put<ModelProvider>(`/admin/providers/${id}`, data)
  return result
}

export async function deleteProvider(id: number): Promise<void> {
  await api.delete(`/admin/providers/${id}`)
}

export async function listModels(): Promise<ModelInfo[]> {
  const { data } = await api.get<ModelInfo[]>('/admin/models')
  return data
}

export async function createModel(data: { provider_id: number; model_id: string; display_name: string }): Promise<ModelInfo> {
  const { data: result } = await api.post<ModelInfo>('/admin/models', data)
  return result
}

export async function updateModel(id: number, data: { is_enabled?: boolean; display_name?: string; model_id?: string }): Promise<ModelInfo> {
  const { data: result } = await api.put<ModelInfo>(`/admin/models/${id}`, data)
  return result
}

export async function deleteModel(id: number): Promise<void> {
  await api.delete(`/admin/models/${id}`)
}

interface UserListItem {
  id: number
  username: string
  is_admin: boolean
  created_at: string
}

export async function listUsers(): Promise<UserListItem[]> {
  const { data } = await api.get<UserListItem[]>('/admin/users')
  return data
}

export async function createUser(data: { username: string; password: string }): Promise<UserListItem> {
  const { data: result } = await api.post<UserListItem>('/admin/users', data)
  return result
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/admin/users/${id}`)
}
```

- [ ] **Step 2: Create AdminLayout.tsx**

```tsx
import { useState } from 'react'
import { Server, Cpu, Users, ArrowLeft } from 'lucide-react'
import ModelProviders from './ModelProviders'
import UserManagement from './UserManagement'

type Tab = 'providers' | 'users'

export default function AdminLayout() {
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-700 px-6 py-3 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></a>
        <h1 className="text-xl font-bold">管理员设置</h1>
      </div>
      <div className="flex">
        <nav className="w-48 border-r border-gray-700 p-4 space-y-1">
          <button
            onClick={() => setTab('providers')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${tab === 'providers' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Server size={16} /> 模型配置
          </button>
          <button
            onClick={() => setTab('users')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${tab === 'users' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Users size={16} /> 用户管理
          </button>
        </nav>
        <main className="flex-1 p-6">
          {tab === 'providers' && <ModelProviders />}
          {tab === 'users' && <UserManagement />}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create ModelProviders.tsx**

```tsx
import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import * as adminApi from '@/api/admin'
import type { ModelProvider, ModelInfo } from '@/types'

export default function ModelProviders() {
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [showAddModel, setShowAddModel] = useState<number | null>(null)
  const [newProvider, setNewProvider] = useState({ name: '', base_url: '', api_key: '' })
  const [newModel, setNewModel] = useState({ model_id: '', display_name: '' })

  const load = async () => {
    const [p, m] = await Promise.all([adminApi.listProviders(), adminApi.listModels()])
    setProviders(p)
    setModels(m)
  }

  useEffect(() => { load() }, [])

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.base_url || !newProvider.api_key) return
    await adminApi.createProvider(newProvider)
    setNewProvider({ name: '', base_url: '', api_key: '' })
    setShowAddProvider(false)
    load()
  }

  const handleAddModel = async (providerId: number) => {
    if (!newModel.model_id || !newModel.display_name) return
    await adminApi.createModel({ provider_id: providerId, ...newModel })
    setNewModel({ model_id: '', display_name: '' })
    setShowAddModel(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">模型配置</h2>
        <button onClick={() => setShowAddProvider(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
          <Plus size={14} /> 添加 Provider
        </button>
      </div>

      {showAddProvider && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <input value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} placeholder="名称（如：通义千问）" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <input value={newProvider.base_url} onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })} placeholder="API 地址" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <input value={newProvider.api_key} onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })} placeholder="API Key" type="password" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <div className="flex gap-2">
            <button onClick={handleAddProvider} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">保存</button>
            <button onClick={() => setShowAddProvider(false)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">取消</button>
          </div>
        </div>
      )}

      {providers.map((p) => (
        <div key={p.id} className="bg-gray-900 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setExpanded({ ...expanded, [p.id]: !expanded[p.id] })} className="flex items-center gap-2 text-left">
              {expanded[p.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-medium">{p.name}</span>
              <span className="text-gray-500 text-sm">{p.base_url}</span>
              <span className="text-gray-600 text-xs">Key: {p.api_key_masked}</span>
            </button>
            <button onClick={() => { adminApi.deleteProvider(p.id).then(load) }} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
          </div>
          {expanded[p.id] && (
            <div className="border-t border-gray-700 p-4 space-y-2">
              {models.filter((m) => m.provider_id === p.id).map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{m.display_name}</span>
                    <span className="text-xs text-gray-500">{m.model_id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.is_enabled ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {m.is_enabled ? '启用' : '禁用'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { adminApi.updateModel(m.id, { is_enabled: !m.is_enabled }).then(load) }} className="text-xs text-gray-400 hover:text-white">
                      {m.is_enabled ? '禁用' : '启用'}
                    </button>
                    <button onClick={() => { adminApi.deleteModel(m.id).then(load) }} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {showAddModel === p.id ? (
                <div className="flex gap-2 mt-2">
                  <input value={newModel.model_id} onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })} placeholder="模型ID (如 qwen-plus)" className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm outline-none" />
                  <input value={newModel.display_name} onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })} placeholder="显示名称" className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm outline-none" />
                  <button onClick={() => handleAddModel(p.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">添加</button>
                  <button onClick={() => setShowAddModel(null)} className="px-2 py-1 bg-gray-700 rounded text-sm">取消</button>
                </div>
              ) : (
                <button onClick={() => setShowAddModel(p.id)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mt-2">
                  <Plus size={14} /> 添加模型
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create UserManagement.tsx**

```tsx
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import * as adminApi from '@/api/admin'

interface UserItem { id: number; username: string; is_admin: boolean; created_at: string }

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '' })

  const load = async () => setUsers(await adminApi.listUsers())
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newUser.username || !newUser.password) return
    await adminApi.createUser(newUser)
    setNewUser({ username: '', password: '' })
    setShowAdd(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">用户管理</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
          <Plus size={14} /> 创建用户
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="用户名" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="密码" type="password" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">创建</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-medium">{u.username}</span>
              {u.is_admin && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">管理员</span>}
              <span className="text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            {!u.is_admin && (
              <button onClick={() => { adminApi.deleteUser(u.id).then(load) }} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Add admin route to App.tsx**

```tsx
import AdminLayout from '@/components/AdminPanel/AdminLayout'

// Add admin link in project list page and route:
<Route path="/admin" element={<AdminLayout />} />
```

Also add an admin link in the ProjectList header (only for admin users):
```tsx
import { useAuthStore } from '@/stores/authStore'

// In ProjectList, add next to the title:
const { user } = useAuthStore()
{user?.is_admin && (
  <a href="/admin" className="text-sm text-gray-400 hover:text-white">管理</a>
)}
```

- [ ] **Step 6: Verify admin panel**

1. Login as admin → see "管理" link in project list
2. Click "管理" → see admin panel
3. Add a Provider (DashScope with real API key)
4. Add models under it (e.g., qwen-plus, qwen-max)
5. Create a new user
6. Logout → login as new user → verify can use the system but not see admin

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/admin.ts frontend/src/components/AdminPanel/ frontend/src/App.tsx
git commit -m "feat: add admin panel with provider, model, and user management"
```

---

## Task 14: Docker Compose + Final Integration

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/.env.example`
- Create: `frontend/Dockerfile`
- Create: `backend/Dockerfile`
- Modify: `frontend/package.json` (add @tailwindcss/vite if missing)

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 2: Create frontend/Dockerfile**

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
```

- [ ] **Step 3: Create docker-compose.yml**

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - mindcanvas-data:/app/data
    environment:
      - DATABASE_URL=sqlite+aiosqlite:///./data/mindcanvas.db
      - SECRET_KEY=change-me-in-production-min-32-chars-long
      - ENCRYPTION_KEY=change-me-in-production-min-32-chars-long
      - CORS_ORIGINS=http://localhost:5173
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      backend:
        condition: service_healthy
    restart: unless-stopped

volumes:
  mindcanvas-data:
```

- [ ] **Step 4: Create backend/.env.example**

```env
DATABASE_URL=sqlite+aiosqlite:///./data/mindcanvas.db
SECRET_KEY=change-me-in-production-min-32-chars-long
ENCRYPTION_KEY=change-me-in-production-min-32-chars-long
ENCRYPTION_SALT=mindcanvas-salt
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 5: Ensure seed script creates data dir**

Update `backend/seed.py` to create the `data/` directory:

```python
import os
os.makedirs("data", exist_ok=True)
```

- [ ] **Step 6: Full integration test**

```bash
docker-compose up --build
```

Then:
1. Open http://localhost:5173
2. Login with admin/admin123
3. Go to admin panel → add a real API provider
4. Create project → add nodes → wire them → chat → export

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile backend/.env.example
git commit -m "feat: add Docker Compose deployment with health checks"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Visual canvas with drag-and-drop nodes (Task 12)
- ✅ Multi-model support with admin config (Task 3, 13)
- ✅ Node context via edges, configurable (Task 4, 11-12)
- ✅ Multi-input branching (Task 5 context_builder, Task 12 edge connections)
- ✅ Multi-round chat in nodes (Task 11)
- ✅ SSE streaming (Task 5, 10)
- ✅ Markdown export (Task 6)
- ✅ Simple auth with admin-created users (Task 2, 13)
- ✅ Persistence with SQLite (Task 1)
- ✅ Docker Compose deployment (Task 14)

**2. Placeholder scan:** No TBD/TODO found. All steps contain exact code.

**3. Type consistency:** All types defined in `frontend/src/types/index.ts` match backend Pydantic schemas and SQLAlchemy models.
