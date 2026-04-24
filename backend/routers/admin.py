from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import hash_password, mask_secret
from models.db import User, ModelProvider, Model, ImageGenConfig
from schemas.admin import (
    ProviderCreate, ProviderUpdate, ProviderResponse,
    ModelCreate, ModelUpdate, ModelResponse,
    UserCreate, UserListResponse, PaginatedResponse,
)
from schemas.image_gen import ImageGenConfigResponse, ImageGenConfigUpdate
from routers.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# --- Provider CRUD ---

@router.get("/providers", response_model=PaginatedResponse[ProviderResponse])
async def list_providers(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total = (await db.execute(select(func.count()).select_from(ModelProvider))).scalar_one()
    result = await db.execute(select(ModelProvider).order_by(ModelProvider.id).offset(skip).limit(limit))
    providers = result.scalars().all()
    return PaginatedResponse(
        items=[
            ProviderResponse(
                id=p.id, name=p.name, base_url=p.base_url,
                api_key_masked=mask_secret(p.api_key), created_at=p.created_at,
            )
            for p in providers
        ],
        total=total, skip=skip, limit=limit,
    )


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

@router.get("/models", response_model=PaginatedResponse[ModelResponse])
async def list_models(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total = (await db.execute(select(func.count()).select_from(Model))).scalar_one()
    result = await db.execute(select(Model).order_by(Model.id).offset(skip).limit(limit))
    items = result.scalars().all()
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


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
    if req.supports_vision is not None:
        model.supports_vision = req.supports_vision
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

@router.get("/users", response_model=PaginatedResponse[UserListResponse])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    total = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    result = await db.execute(select(User).order_by(User.id).offset(skip).limit(limit))
    items = result.scalars().all()
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


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


# --- ImageGen Config ---

@router.get("/image-gen-config", response_model=ImageGenConfigResponse)
async def get_image_gen_config(db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(ImageGenConfig).order_by(ImageGenConfig.id).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        # Auto-create default config
        config = ImageGenConfig()
        config.api_key = ""
        db.add(config)
        await db.commit()
        await db.refresh(config)
    return ImageGenConfigResponse(
        id=config.id,
        name=config.name,
        base_url=config.base_url,
        model_id=config.model_id,
        api_key_masked=mask_secret(config.api_key),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )


@router.put("/image-gen-config", response_model=ImageGenConfigResponse)
async def update_image_gen_config(req: ImageGenConfigUpdate, db: AsyncSession = Depends(get_db), _: User = Depends(require_admin)):
    result = await db.execute(select(ImageGenConfig).order_by(ImageGenConfig.id).limit(1))
    config = result.scalar_one_or_none()
    if not config:
        config = ImageGenConfig()
        db.add(config)

    if req.name is not None:
        config.name = req.name
    if req.base_url is not None:
        config.base_url = req.base_url
    if req.model_id is not None:
        config.model_id = req.model_id
    if req.api_key is not None:
        config.api_key = req.api_key

    await db.commit()
    await db.refresh(config)
    return ImageGenConfigResponse(
        id=config.id,
        name=config.name,
        base_url=config.base_url,
        model_id=config.model_id,
        api_key_masked=mask_secret(config.api_key),
        created_at=config.created_at,
        updated_at=config.updated_at,
    )
