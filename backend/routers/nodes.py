import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db, async_session
from models.db import Project, Node, Edge, Message, User, Model
from schemas.node import (
    NodeCreate, NodeUpdate, NodeResponse,
    EdgeCreate, EdgeUpdate, EdgeResponse,
    MessageResponse,
)
from routers.auth import get_current_user
from services.llm_client import stream_chat
from services.context_builder import build_context_messages

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
