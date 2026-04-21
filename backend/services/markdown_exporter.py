from datetime import datetime, timezone
from typing import Dict, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.db import Project, Node, Edge, Message, Model, ModelProvider


async def export_project_markdown(project_id: int, db: AsyncSession) -> str:
    """Export a project as a structured Markdown document."""
    # Load project
    project = await db.get(Project, project_id)
    if not project:
        return "# Error: Project not found"

    # Load nodes
    nodes_result = await db.execute(select(Node).where(Node.project_id == project_id).order_by(Node.id))
    nodes = {n.id: n for n in nodes_result.scalars().all()}

    # Load edges
    edges_result = await db.execute(select(Edge).where(Edge.project_id == project_id).order_by(Edge.id))
    edges = edges_result.scalars().all()

    # Build adjacency for dependency info
    incoming: Dict[int, List[Edge]] = {}
    for e in edges:
        incoming.setdefault(e.target_node_id, []).append(e)

    lines = []
    lines.append(f"# {project.name}")
    lines.append("")
    lines.append(f"> 导出时间：{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')}")
    lines.append("")

    # Flow overview
    lines.append("## 流程概览")
    lines.append("")
    if edges:
        for e in edges:
            src = nodes.get(e.source_node_id)
            tgt = nodes.get(e.target_node_id)
            if src and tgt:
                lines.append(f"- {src.label} → {tgt.label}")
    else:
        lines.append("（无连线，各节点独立）")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Each node
    for node in nodes.values():
        model = await db.get(Model, node.model_id)
        provider = await db.get(ModelProvider, model.provider_id) if model else None
        model_display = f"{model.display_name} ({provider.name})" if model and provider else "未知模型"

        deps = incoming.get(node.id, [])
        dep_labels = []
        for d in deps:
            src = nodes.get(d.source_node_id)
            mode_text = "全部对话历史" if d.context_mode == "full_history" else "仅最后回复"
            if src:
                dep_labels.append(f"{src.label}（{mode_text}）")

        lines.append(f"## {node.label}")
        lines.append("")
        lines.append(f"**模型：** {model_display}")
        if dep_labels:
            lines.append(f"**上下文来源：** {', '.join(dep_labels)}")
        lines.append("")

        # Messages
        msg_result = await db.execute(
            select(Message).where(Message.node_id == node.id).order_by(Message.created_at)
        )
        messages = msg_result.scalars().all()
        if messages:
            lines.append("### 对话")
            lines.append("")
            for m in messages:
                role_label = "**用户：**" if m.role == "user" else "**助手：**"
                lines.append(f"{role_label} {m.content}")
                lines.append("")
        else:
            lines.append("（暂无对话）")
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)
