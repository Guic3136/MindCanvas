import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from collections import deque
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db, async_session
from models.db import Node, Edge, Message, User, Model
from schemas.node import (
    NodeCreate, NodeUpdate, NodeResponse,
    EdgeCreate, EdgeUpdate, EdgeResponse,
    MessageResponse,
)
from routers.auth import get_current_user
from core.auth import verify_project_ownership
from services.llm_client import stream_chat
from services.context_builder import build_context_messages
from services.file_parser import get_file_text
from services.web_fetcher import fetch_webpage_text
from services.code_runner import run_code

router = APIRouter(prefix="/api/projects/{project_id}", tags=["nodes"])


# --- Nodes ---

@router.post("/nodes", response_model=NodeResponse)
async def create_node(project_id: int, req: NodeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = Node(project_id=project_id, model_id=req.model_id, node_type=req.node_type, label=req.label, position_x=req.position_x, position_y=req.position_y)
    # Set type-specific fields
    for field in [
        'file_url', 'file_name', 'file_type',
        'web_url', 'web_content', 'note_content',
        'transform_prompt', 'transform_output', 'compare_model_ids',
        'code_language', 'code_script', 'code_output',
        'image_gen_prompt', 'image_gen_url',
    ]:
        value = getattr(req, field, None)
        if value is not None:
            setattr(node, field, value)
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@router.put("/nodes/{nid}", response_model=NodeResponse)
async def update_node(project_id: int, nid: int, req: NodeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
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
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")
    await db.delete(node)
    await db.commit()
    return {"ok": True}


@router.get("/nodes/{nid}/messages", response_model=list[MessageResponse])
async def get_messages(project_id: int, nid: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")
    result = await db.execute(select(Message).where(Message.node_id == nid).order_by(Message.created_at))
    return result.scalars().all()


# --- Edges ---

@router.post("/edges", response_model=EdgeResponse)
async def create_edge(project_id: int, req: EdgeCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)

    if req.source_node_id == req.target_node_id:
        raise HTTPException(status_code=400, detail="Self-referencing edge is not allowed")

    result = await db.execute(
        select(Edge).where(
            Edge.project_id == project_id,
            Edge.source_node_id == req.source_node_id,
            Edge.target_node_id == req.target_node_id,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Edge already exists between these nodes")

    edges_result = await db.execute(
        select(Edge.source_node_id, Edge.target_node_id).where(Edge.project_id == project_id)
    )
    adjacency: dict[int, list[int]] = {}
    for src, tgt in edges_result.all():
        adjacency.setdefault(src, []).append(tgt)

    queue = deque([req.target_node_id])
    visited = {req.target_node_id}
    while queue:
        current = queue.popleft()
        for neighbor in adjacency.get(current, []):
            if neighbor == req.source_node_id:
                raise HTTPException(status_code=400, detail="Creating this edge would form a cycle")
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)

    edge = Edge(project_id=project_id, source_node_id=req.source_node_id, target_node_id=req.target_node_id, context_mode=req.context_mode)
    db.add(edge)
    await db.commit()
    await db.refresh(edge)
    return edge


@router.put("/edges/{eid}", response_model=EdgeResponse)
async def update_edge(project_id: int, eid: int, req: EdgeUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    edge = await db.get(Edge, eid)
    if not edge or edge.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edge not found")
    edge.context_mode = req.context_mode
    await db.commit()
    await db.refresh(edge)
    return edge


@router.delete("/edges/{eid}")
async def delete_edge(project_id: int, eid: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    edge = await db.get(Edge, eid)
    if not edge or edge.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edge not found")
    await db.delete(edge)
    await db.commit()
    return {"ok": True}


@router.post("/nodes/{nid}/chat")
async def chat(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)

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

    # For file nodes, prepend file content as system context
    if node.node_type == "file" and node.file_url:
        file_text = get_file_text(node.file_url, node.file_type)
        file_prompt = f"以下是用户上传的文件内容，请基于这些内容回答问题。\n\n文件名: {node.file_name or '未命名'}\n\n{file_text}"
        messages.insert(0, {"role": "system", "content": file_prompt})

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


@router.post("/nodes/{nid}/fetch-web")
async def fetch_web(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    text = await fetch_webpage_text(url)
    node.web_url = url
    node.web_content = text
    await db.commit()
    await db.refresh(node)
    return {"url": url, "content_preview": text[:500]}


@router.post("/nodes/{nid}/transform")
async def transform_text(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    prompt = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Build context from upstream nodes
    context = await build_context_messages(nid, db)
    input_text = ""
    if context:
        input_text = "\n\n".join(c.get("content", "") for c in context)

    system_msg = f"你是一个文本处理助手。请根据以下指令处理输入文本：\n\n指令：{prompt}\n\n只输出处理后的结果，不要添加解释。"
    if input_text:
        system_msg += f"\n\n输入文本：\n{input_text}"

    messages = [{"role": "system", "content": system_msg}]
    if input_text:
        messages.append({"role": "user", "content": input_text})
    else:
        messages.append({"role": "user", "content": "请执行上述指令。"})

    provider = node.model.provider
    model_id = node.model.model_id
    base_url = provider.base_url
    api_key = provider.api_key

    result_tokens = []
    async for token in stream_chat(base_url, api_key, model_id, messages):
        result_tokens.append(token)

    output = "".join(result_tokens)
    node.transform_prompt = prompt
    node.transform_output = output
    await db.commit()
    await db.refresh(node)
    return {"output": output}


import asyncio


@router.post("/nodes/{nid}/compare")
async def compare_models(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    model_ids = body.get("model_ids", [])
    if len(model_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 models required")

    # Build context from upstream nodes
    context = await build_context_messages(nid, db)
    input_text = ""
    if context:
        input_text = "\n\n".join(c.get("content", "") for c in context)

    if not input_text:
        raise HTTPException(status_code=400, detail="No input from upstream nodes")

    messages = [{"role": "user", "content": input_text}]

    # Fetch models
    model_results = {}
    from sqlalchemy import select as sa_select
    from models.db import Model as ModelDB

    for mid in model_ids:
        m_result = await db.execute(sa_select(ModelDB).where(ModelDB.id == mid).options(selectinload(ModelDB.provider)))
        model = m_result.scalar_one_or_none()
        if not model:
            continue

        provider = model.provider
        try:
            tokens = []
            async for token in stream_chat(provider.base_url, provider.api_key, model.model_id, messages):
                tokens.append(token)
            model_results[mid] = "".join(tokens)
        except Exception as e:
            model_results[mid] = f"[错误: {e}]"

    import json
    node.compare_model_ids = json.dumps(model_ids)
    await db.commit()
    return {"results": model_results}


@router.post("/nodes/{nid}/run-code")
async def run_code_endpoint(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    language = body.get("language", "python")
    script = body.get("script", "").strip()
    if not script:
        raise HTTPException(status_code=400, detail="Script cannot be empty")

    output = await run_code(language, script)
    node.code_language = language
    node.code_script = script
    node.code_output = output
    await db.commit()
    return {"output": output}


@router.post("/nodes/{nid}/generate-image")
async def generate_image(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    prompt = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # For now, return a placeholder since image generation requires external API setup
    # In production, this would call DALL-E / Midjourney / Stable Diffusion API
    placeholder_url = "https://placehold.co/512x512/2d224d/c2ef4e?text=Image+Generation+Placeholder"

    node.image_gen_prompt = prompt
    node.image_gen_url = placeholder_url
    await db.commit()
    return {"url": placeholder_url, "prompt": prompt}
