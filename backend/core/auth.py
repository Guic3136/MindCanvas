from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.db import Project, User


async def verify_project_ownership(
    project_id: int,
    current_user: User,
    db: AsyncSession,
) -> Project:
    """Get a project and verify ownership. Returns the project or raises 404."""
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.owner_id == current_user.id,
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
