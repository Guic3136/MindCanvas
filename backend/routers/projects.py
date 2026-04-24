import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from models.db import Project, User
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem, NodeBrief, EdgeBrief, PaginatedResponse
from routers.auth import get_current_user
from core.auth import verify_project_ownership

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=PaginatedResponse[ProjectListItem])
async def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = (await db.execute(select(func.count()).select_from(Project).where(Project.owner_id == current_user.id))).scalar_one()
    result = await db.execute(
        select(Project).where(Project.owner_id == current_user.id).order_by(Project.updated_at.desc()).offset(skip).limit(limit)
    )
    items = result.scalars().all()
    return PaginatedResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=ProjectResponse)
async def create_project(req: ProjectCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = Project(name=req.name, owner_id=current_user.id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    result = await db.execute(
        select(Project).where(Project.id == project.id, Project.owner_id == current_user.id)
        .options(selectinload(Project.nodes), selectinload(Project.edges))
    )
    return result.scalar_one()


@router.get("/{pid}", response_model=ProjectResponse)
async def get_project(pid: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await verify_project_ownership(pid, current_user, db)
    result = await db.execute(
        select(Project).where(Project.id == pid).options(selectinload(Project.nodes), selectinload(Project.edges))
    )
    return result.scalar_one()


@router.put("/{pid}", response_model=ProjectResponse)
async def update_project(pid: int, req: ProjectUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    await verify_project_ownership(pid, current_user, db)
    result = await db.execute(select(Project).where(Project.id == pid))
    project = result.scalar_one()
    project.name = req.name
    await db.commit()
    result = await db.execute(
        select(Project).where(Project.id == pid)
        .options(selectinload(Project.nodes), selectinload(Project.edges))
    )
    return result.scalar_one()


@router.delete("/{pid}")
async def delete_project(pid: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    project = await verify_project_ownership(pid, current_user, db)
    await db.delete(project)
    await db.commit()
    return {"ok": True}


ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "gif", "webp", "xlsx", "xls", "csv"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/{pid}/upload")
async def upload_file(
    pid: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await verify_project_ownership(pid, current_user, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小超过 20MB 限制")

    project_upload_dir = os.path.join(UPLOAD_DIR, str(pid))
    os.makedirs(project_upload_dir, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}_{file.filename}"
    file_path = os.path.join(project_upload_dir, safe_name)

    with open(file_path, "wb") as f:
        f.write(content)

    file_type_map = {
        "pdf": "pdf",
        "png": "image", "jpg": "image", "jpeg": "image", "gif": "image", "webp": "image",
        "xlsx": "excel", "xls": "excel", "csv": "excel",
    }
    file_type = file_type_map.get(ext, "unknown")

    # Compress images > 2MB
    if file_type == "image" and len(content) > 2 * 1024 * 1024:
        try:
            from PIL import Image
            img = Image.open(file_path)
            max_width = 1920
            if img.width > max_width:
                ratio = max_width / img.width
                new_height = int(img.height * ratio)
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            save_kwargs = {"optimize": True, "quality": 85}
            if ext in ("png", "gif"):
                save_kwargs = {"optimize": True}
            img.save(file_path, **save_kwargs)
        except Exception:
            pass

    return {
        "url": f"/uploads/{pid}/{safe_name}",
        "name": file.filename,
        "type": file_type,
        "size": os.path.getsize(file_path),
    }
