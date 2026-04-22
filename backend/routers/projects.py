from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from models.db import Project, User
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem, NodeBrief, EdgeBrief, PaginatedResponse
from routers.auth import get_current_user
from core.auth import verify_project_ownership

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
