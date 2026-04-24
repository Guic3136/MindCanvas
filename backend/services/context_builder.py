import base64
import os
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.db import Node, Edge, Message
from services.file_parser import get_file_text

# Upload files are stored at backend/uploads/ relative to this file's parent dir
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")


def _image_url_to_data_url(file_url: str, file_type: str) -> str | None:
    """Convert a local /uploads/... path to a base64 data URL for LLM APIs."""
    if not file_url.startswith("/uploads/"):
        return file_url
    relative_path = file_url[len("/uploads/"):]  # e.g. "5/image.png"
    abs_path = os.path.join(UPLOAD_DIR, relative_path)
    if not os.path.isfile(abs_path):
        return None
    # Infer MIME type from file extension; file_type may be generic (e.g. "image")
    ext = os.path.splitext(abs_path)[1].lower().lstrip(".")
    mime_type = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
    }.get(ext, "image/jpeg")
    with open(abs_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime_type};base64,{b64}"


async def build_context_messages(target_node_id: int, db: AsyncSession) -> list:
    """Build context messages from upstream nodes for the target node."""
    result = await db.execute(
        select(Edge).where(Edge.target_node_id == target_node_id).order_by(Edge.id)
    )
    edges = result.scalars().all()

    if not edges:
        return []

    seen_message_ids: set[int] = set()
    context_messages = []

    for edge in edges:
        source_node = await db.get(Node, edge.source_node_id)
        if not source_node:
            continue

        # Route filter for transform nodes
        if source_node.node_type == "transform" and source_node.routing_rules:
            if edge.route_tag and edge.route_tag != source_node.transform_route:
                continue

        # === file type: extract file text or vision url as context ===
        if source_node.node_type == "file" and source_node.file_url:
            if source_node.file_type == "image":
                image_data_url = _image_url_to_data_url(source_node.file_url, source_node.file_type)
                context_messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f'[来自文件节点"{source_node.label}"的图片]'},
                        {"type": "image_url", "image_url": {"url": image_data_url or source_node.file_url}},
                    ],
                })
            else:
                file_text = get_file_text(source_node.file_url, source_node.file_type)
                context_messages.append({
                    "role": "user",
                    "content": f'[来自文件节点"{source_node.label}"的内容]\n文件名: {source_node.file_name or "未命名"}\n\n{file_text}',
                })
            continue

        # === note type: use note_content as context ===
        if source_node.node_type == "note" and source_node.note_content:
            context_messages.append({
                "role": "user",
                "content": f'[来自便签节点"{source_node.label}"的内容]\n\n{source_node.note_content}',
            })
            continue

        # === web type: use web_content as context ===
        if source_node.node_type == "web" and source_node.web_content:
            context_messages.append({
                "role": "user",
                "content": f'[来自网页节点"{source_node.label}"的抓取内容]\nURL: {source_node.web_url or ""}\n\n{source_node.web_content}',
            })
            continue

        # === chat type: use messages as context (default behavior) ===
        if edge.context_mode == "full_history":
            msg_result = await db.execute(
                select(Message).where(Message.node_id == edge.source_node_id).order_by(Message.created_at)
            )
            source_messages = msg_result.scalars().all()
        else:  # last_reply
            msg_result = await db.execute(
                select(Message).where(Message.node_id == edge.source_node_id, Message.role == "assistant").order_by(Message.created_at.desc())
            )
            last_msg = msg_result.scalars().first()
            source_messages = [last_msg] if last_msg else []

        deduped = []
        for m in source_messages:
            if m.id not in seen_message_ids:
                seen_message_ids.add(m.id)
                deduped.append(m)

        if deduped:
            context_messages.append({
                "role": "user",
                "content": f'[来自"{source_node.label}"的上下文]\n' + "\n\n".join(
                    f"{'用户' if m.role == 'user' else '助手'}: {m.content}" for m in deduped
                ),
            })

    return context_messages
