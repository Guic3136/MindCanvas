from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.db import Node, Edge, Message


async def build_context_messages(target_node_id: int, db: AsyncSession) -> list:
    """Build context messages from upstream nodes for the target node."""
    # Get all edges targeting this node
    result = await db.execute(
        select(Edge).where(Edge.target_node_id == target_node_id).order_by(Edge.id)
    )
    edges = result.scalars().all()

    if not edges:
        return []

    context_messages = []
    for edge in edges:
        # Get source node info
        source_node = await db.get(Node, edge.source_node_id)
        if not source_node:
            continue

        # Get messages from source node
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

        if source_messages:
            context_messages.append({
                "role": "user",
                "content": f'[来自"{source_node.label}"的上下文]\n' + "\n\n".join(
                    f"{'用户' if m.role == 'user' else '助手'}: {m.content}" for m in source_messages
                ),
            })

    return context_messages
