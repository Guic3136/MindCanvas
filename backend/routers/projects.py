from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from core.database import get_db
from models.db import Project, User
from schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem, NodeBrief, EdgeBrief
from routers.auth import get_current_user

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
    result = await db.execute(
        select(Project).where(Project.id == project.id, Project.owner_id == current_user.id)
        .options(selectinload(Project.nodes), selectinload(Project.edges))
    )
    return result.scalar_one()


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
    result = await db.execute(
        select(Project).where(Project.id == pid, Project.owner_id == current_user.id)
        .options(selectinload(Project.nodes), selectinload(Project.edges))
    )
    return result.scalar_one()


@router.delete("/{pid}")
async def delete_project(pid: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Project).where(Project.id == pid, Project.owner_id == current_user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return {"ok": True}
