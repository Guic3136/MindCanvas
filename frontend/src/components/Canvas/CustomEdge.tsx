import { BaseEdge, EdgeProps, getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import { useState } from 'react'
import { X, Settings } from 'lucide-react'

interface CustomEdgeData {
  context_mode: string
  db_edge_id: number
  onModeChange: (edgeId: number, mode: string) => void
  onRemove: (edgeId: number) => void
}

export default function CustomEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const [showMenu, setShowMenu] = useState(false)
  const edgeData = data as unknown as CustomEdgeData

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{ stroke: selected ? 'var(--color-brand)' : '#6a5fc1', strokeWidth: selected ? 2.5 : 1.5 }}
        markerEnd="url(#arrow)"
      />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          className="nodrag nopan"
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="bg-bg-elevated border border-border-strong rounded-full p-2.5 text-text-muted hover:text-text-primary hover:border-border-hover shadow-popover transition-ui"
            aria-label="连线设置"
          >
            <Settings size={16} />
          </button>
          {showMenu && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-bg-elevated border border-border-strong rounded-lg shadow-popover p-2 space-y-1 z-50 min-w-32">
              <button
                onClick={() => { edgeData.onModeChange(edgeData.db_edge_id, 'full_history'); setShowMenu(false) }}
                className={`block w-full text-left text-xs px-2 py-1 rounded transition-ui ${edgeData.context_mode === 'full_history' ? 'bg-brand text-text-inverse' : 'text-text-secondary hover:bg-bg-hover'}`}
              >
                整条历史
              </button>
              <button
                onClick={() => { edgeData.onModeChange(edgeData.db_edge_id, 'last_reply'); setShowMenu(false) }}
                className={`block w-full text-left text-xs px-2 py-1 rounded transition-ui ${edgeData.context_mode === 'last_reply' ? 'bg-brand text-text-inverse' : 'text-text-secondary hover:bg-bg-hover'}`}
              >
                仅最后回复
              </button>
              <hr className="border-border" />
              <button
                onClick={() => { if (window.confirm('确定要删除此连线吗？')) { edgeData.onRemove(edgeData.db_edge_id); setShowMenu(false) } }}
                className="block w-full text-left text-xs px-2 py-1 rounded text-danger hover:bg-bg-hover transition-ui"
              >
                <X size={14} className="inline mr-1" /> 删除连线
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
