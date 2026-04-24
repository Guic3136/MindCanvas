import { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import ChatNodeHeader from './ChatNodeHeader'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import client from '../../api/client'

interface NoteNodeData {
  label: string
  db_node_id: number
  project_id: number
  note_content?: string
}

export default function NoteNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, db_node_id, project_id, note_content } = data as unknown as NoteNodeData
  const { updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [content, setContent] = useState(note_content || '')

  const handleBlur = useCallback(() => {
    client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
      note_content: content,
    }).catch((err) => {
      console.error('[NoteNode] save failed:', err)
    })
  }, [project_id, db_node_id, content])

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={120}
        isVisible={selected}
        onResizeEnd={(_event, params) => {
          updateNodeSize(db_node_id, { width: params.width, height: params.height })
        }}
      />
      <div
        className={`relative bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
        style={{ width: width || 280, height: height || 200, minHeight: 120 }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg" style={{ backgroundColor: nodeColor }} />
        <ChatNodeHeader
          label={label}
          onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
          onDelete={() => removeNode(db_node_id)}
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onBlur={handleBlur}
          placeholder="输入笔记内容..."
          className="flex-1 bg-transparent text-text-primary text-sm p-3 resize-none outline-none"
          style={{ minHeight: 60 }}
        />
      </div>
    </>
  )
}
