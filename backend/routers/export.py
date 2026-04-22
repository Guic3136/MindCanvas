from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from models.db import User
from routers.auth import get_current_user
from core.auth import verify_project_ownership
from services.markdown_exporter import export_project_markdown

router = APIRouter(tags=["export"])


@router.post("/api/projects/{project_id}/export", response_class=PlainTextResponse)
async def export_markdown(project_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    project = await verify_project_ownership(project_id, user, db)
    content = await export_project_markdown(project_id, db)
    return PlainTextResponse(content, headers={"Content-Disposition": f'attachment; filename="project-{project_id}.md"'})
