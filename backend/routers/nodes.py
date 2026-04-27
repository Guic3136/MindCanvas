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
from services.image_gen_client import generate_image, SIZE_MAP
from models.db import ImageGenConfig

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
        'transform_prompt', 'transform_output',
        'transform_format', 'merge_strategy', 'self_critique', 'max_iterations',
        'compare_model_ids',
        'image_gen_prompt', 'image_gen_url',
        'batch_mode', 'routing_rules', 'transform_route',
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

    edge = Edge(project_id=project_id, source_node_id=req.source_node_id, target_node_id=req.target_node_id, context_mode=req.context_mode, route_tag=req.route_tag)
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

    result = await db.execute(
        select(Node).where(Node.id == nid, Node.project_id == project_id).options(selectinload(Node.model).selectinload(Model.provider))
    )
    node = result.scalar_one_or_none()
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")

    text = await fetch_webpage_text(url)

    # Summarize if content exceeds 10000 chars
    if len(text) > 10000:
        provider = node.model.provider
        summary_prompt = (
            "请提炼以下网页的核心内容，保留关键事实、数据和结论，去除广告、导航等无关信息。"
            "输出控制在 5000 字符以内。"
        )
        messages = [
            {"role": "system", "content": summary_prompt},
            {"role": "user", "content": text},
        ]
        tokens = []
        async for token in stream_chat(provider.base_url, provider.api_key, node.model.model_id, messages):
            tokens.append(token)
        text = "".join(tokens)

    node.web_url = url
    node.web_content = text
    await db.commit()
    await db.refresh(node)
    return {"url": url, "content_preview": text[:500]}


@router.post("/nodes/{nid}/transform")
async def transform_text(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)

    result = await db.execute(
        select(Node).where(Node.id == nid, Node.project_id == project_id).options(selectinload(Node.model).selectinload(Model.provider))
    )
    node = result.scalar_one_or_none()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    prompt = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Build context from upstream nodes
    context = await build_context_messages(nid, db)
    upstream_contents = []
    upstream_variables = {}
    for c in context:
        content = c.get("content", "")
        upstream_contents.append(content)
        # Try parse JSON to extract template variables
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                upstream_variables.update(parsed)
        except (json.JSONDecodeError, TypeError):
            pass

    # Template filling: replace {{variable}} in prompt
    filled_prompt = prompt
    for key, val in upstream_variables.items():
        if isinstance(val, str):
            filled_prompt = filled_prompt.replace(f"{{{{{key}}}}}", val)

    # Multi-input merge based on merge_strategy
    merge_strategy = node.merge_strategy or "concat"
    if merge_strategy == "concat":
        input_text = "\n\n".join(upstream_contents)
    elif merge_strategy == "summarize":
        input_text = "请综合以下多个来源，生成统一摘要：\n\n" + "\n\n---\n\n".join(upstream_contents)
    elif merge_strategy == "diff":
        if len(upstream_contents) >= 2:
            input_text = f"请比较以下两个来源的差异：\n\n来源一：\n{upstream_contents[0]}\n\n来源二：\n{upstream_contents[1]}"
        else:
            input_text = "\n\n".join(upstream_contents)
    else:
        input_text = "\n\n".join(upstream_contents)

    # Structured output format constraints
    transform_format = node.transform_format or "text"
    format_constraints = {
        "json": "You MUST output valid JSON. Do not include markdown code block markers.",
        "yaml": "You MUST output valid YAML.",
        "markdown_table": "You MUST output a Markdown table.",
    }
    format_instruction = format_constraints.get(transform_format, "")

    system_msg = "你是一个文本处理助手。请根据以下指令处理输入文本：\n\n指令：" + filled_prompt
    if format_instruction:
        system_msg += f"\n\n{format_instruction}"
    system_msg += "\n\n只输出处理后的结果，不要添加解释。"
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

    async def _run_chat(msgs: list) -> str:
        tokens = []
        async for token in stream_chat(base_url, api_key, model_id, msgs):
            tokens.append(token)
        return "".join(tokens)

    async def _run_single(item_prompt: str, item_text: str) -> str:
        item_system = "你是一个文本处理助手。请根据以下指令处理输入文本：\n\n指令：" + item_prompt
        if format_instruction:
            item_system += f"\n\n{format_instruction}"
        item_system += "\n\n只输出处理后的结果，不要添加解释。"
        if item_text:
            item_system += f"\n\n输入文本：\n{item_text}"
        item_messages = [{"role": "system", "content": item_system}]
        if item_text:
            item_messages.append({"role": "user", "content": item_text})
        else:
            item_messages.append({"role": "user", "content": "请执行上述指令。"})
        return await _run_chat(item_messages)

    # Batch mode: if upstream contains a JSON array, process each item
    batch_outputs = []
    if node.batch_mode:
        for content in upstream_contents:
            try:
                items = json.loads(content)
                if isinstance(items, list):
                    for item in items:
                        item_prompt = prompt
                        item_text = ""
                        if isinstance(item, dict):
                            for k, v in item.items():
                                if isinstance(v, str):
                                    item_prompt = item_prompt.replace(f"{{{{{k}}}}}", v)
                            item_text = item.get("content") or item.get("text") or str(item)
                        elif isinstance(item, str):
                            item_text = item
                        batch_outputs.append(await _run_single(item_prompt, item_text))
                    break
            except (json.JSONDecodeError, TypeError):
                pass

    if batch_outputs:
        output = "\n\n---\n\n".join(batch_outputs)
    else:
        output = await _run_chat(messages)

        # Self-critique loop
        if node.self_critique:
            max_iterations = node.max_iterations or 3
            best_output = output
            best_rating = 0

            for iteration in range(max_iterations):
                critique_prompt = (
                    f"请评价以下输出是否满足要求：'{filled_prompt}'\n\n"
                    f"输出内容：\n{output}\n\n"
                    "请从1到10打分，并列出存在的问题。格式：\n评分：X\n问题：..."
                )
                critique_msgs = [
                    {"role": "system", "content": "你是一个严格的评审专家。"},
                    {"role": "user", "content": critique_prompt},
                ]
                critique_result = await _run_chat(critique_msgs)

                # Parse rating
                rating = 0
                for line in critique_result.split("\n"):
                    if line.startswith("评分：") or line.startswith("评分:"):
                        try:
                            rating = int(line.split("：")[-1].split(":")[-1].strip().split()[0])
                        except (ValueError, IndexError):
                            pass
                        break

                if rating > best_rating:
                    best_rating = rating
                    best_output = output

                if rating >= 8 or iteration >= max_iterations - 1:
                    break

                # Retry with feedback
                retry_prompt = (
                    f"原始指令：{filled_prompt}\n\n"
                    f"上次输出：{output}\n\n"
                    f"评审反馈（评分 {rating}/10）：{critique_result}\n\n"
                    "请根据反馈改进输出，只输出最终结果。"
                )
                if format_instruction:
                    retry_prompt += f"\n{format_instruction}"
                retry_msgs = [
                    {"role": "system", "content": retry_prompt},
                    {"role": "user", "content": "请输出改进后的结果。"},
                ]
                output = await _run_chat(retry_msgs)

            output = best_output

    # Validate structured output
    if transform_format == "json":
        try:
            json.loads(output)
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=422, detail=f"Generated output is not valid JSON: {e}")
    elif transform_format == "yaml":
        try:
            import yaml
            yaml.safe_load(output)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Generated output is not valid YAML: {e}")

    # Routing rules: match output to route
    route = None
    if node.routing_rules:
        for line in node.routing_rules.strip().split("\n"):
            line = line.strip()
            if "->" not in line:
                continue
            left, right = line.rsplit("->", 1)
            tag = right.strip()
            if left.strip().lower() == "default":
                route = tag
                break
            keywords = [k.strip() for k in left.split(",")]
            for kw in keywords:
                if kw and kw in output:
                    route = tag
                    break
            if route:
                break

    node.transform_prompt = prompt
    node.transform_output = output
    node.transform_route = route
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
    from sqlalchemy import select as sa_select
    from models.db import Model as ModelDB

    models = []
    for mid in model_ids:
        m_result = await db.execute(sa_select(ModelDB).where(ModelDB.id == mid).options(selectinload(ModelDB.provider)))
        model = m_result.scalar_one_or_none()
        if model:
            models.append(model)

    if len(models) < 2:
        raise HTTPException(status_code=400, detail="Valid models less than 2")

    node.compare_model_ids = json.dumps(model_ids)
    await db.commit()

    # Parallel streaming with queue
    queue: asyncio.Queue = asyncio.Queue()

    async def _stream_one(model: ModelDB):
        try:
            provider = model.provider
            async for token in stream_chat(provider.base_url, provider.api_key, model.model_id, messages):
                await queue.put({"model_id": model.id, "model_name": model.display_name, "chunk": token})
            await queue.put({"model_id": model.id, "model_name": model.display_name, "done": True})
        except Exception as e:
            await queue.put({"model_id": model.id, "model_name": model.display_name, "error": str(e)})

    tasks = [asyncio.create_task(_stream_one(m)) for m in models]

    async def event_generator():
        completed = 0
        while completed < len(tasks):
            item = await queue.get()
            if item.get("done") or item.get("error"):
                completed += 1
            yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
        yield f"data: {json.dumps({'type': 'all_done'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/nodes/{nid}/generate-image")
async def generate_image_endpoint(project_id: int, nid: int, body: dict, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await verify_project_ownership(project_id, user, db)
    node = await db.get(Node, nid)
    if not node or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    prompt = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    # Get image generation config
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ImageGenConfig).order_by(ImageGenConfig.id).limit(1))
    config = result.scalar_one_or_none()
    if not config or not config.api_key:
        raise HTTPException(status_code=400, detail="Image generation not configured. Please set up in admin panel.")

    size_label = body.get("size", "方形图")
    size = SIZE_MAP.get(size_label, "1024*1024")
    negative_prompt = body.get("negative_prompt", "")
    n = min(body.get("n", 1), 4)

    try:
        image_urls = await generate_image(
            api_key=config.api_key,
            prompt=prompt,
            base_url=config.base_url,
            model_id=config.model_id,
            size=size,
            negative_prompt=negative_prompt,
            n=n,
            prompt_extend=False,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {e}")

    node.image_gen_prompt = prompt
    node.image_gen_url = image_urls[0] if image_urls else ""
    await db.commit()
    return {"urls": image_urls, "prompt": prompt}
