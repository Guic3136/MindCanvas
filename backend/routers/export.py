from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from models.db import User, Project
from routers.auth import get_current_user
from services.markdown_exporter import export_project_markdown

router = APIRouter(tags=["export"])


@router.post("/api/projects/{project_id}/export", response_class=PlainTextResponse)
async def export_markdown(project_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    # Verify project ownership
    result = await db.execute(select(Project).where(Project.id == project_id, Project.owner_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    content = await export_project_markdown(project_id, db)
    return PlainTextResponse(content, headers={"Content-Disposition": f'attachment; filename="project-{project_id}.md"'})
