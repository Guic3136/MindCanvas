from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.db import Node, Edge, Message
from services.file_parser import get_file_text


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

        # === file type: extract file text or vision url as context ===
        if source_node.node_type == "file" and source_node.file_url:
            if source_node.file_type == "image":
                context_messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f'[来自文件节点"{source_node.label}"的图片]'},
                        {"type": "image_url", "image_url": {"url": source_node.file_url}},
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
