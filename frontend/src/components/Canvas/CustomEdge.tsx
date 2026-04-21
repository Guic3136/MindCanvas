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
        style={{ stroke: selected ? '#3b82f6' : '#6b7280', strokeWidth: selected ? 2 : 1.5 }}
        markerEnd="url(#arrow)"
      />
      <EdgeLabelRenderer>
        <div
          style={{ position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'all' }}
          className="nodrag nopan"
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="bg-gray-800 border border-gray-600 rounded-full p-1 text-gray-400 hover:text-white hover:border-gray-400"
          >
            <Settings size={12} />
          </button>
          {showMenu && (
            <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 space-y-1 z-50 min-w-32">
              <button
                onClick={() => { edgeData.onModeChange(edgeData.db_edge_id, 'full_history'); setShowMenu(false) }}
                className={`block w-full text-left text-xs px-2 py-1 rounded ${edgeData.context_mode === 'full_history' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                整条历史
              </button>
              <button
                onClick={() => { edgeData.onModeChange(edgeData.db_edge_id, 'last_reply'); setShowMenu(false) }}
                className={`block w-full text-left text-xs px-2 py-1 rounded ${edgeData.context_mode === 'last_reply' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                仅最后回复
              </button>
              <hr className="border-gray-600" />
              <button
                onClick={() => { edgeData.onRemove(edgeData.db_edge_id); setShowMenu(false) }}
                className="block w-full text-left text-xs px-2 py-1 rounded text-red-400 hover:bg-gray-700"
              >
                <X size={12} className="inline mr-1" /> 删除连线
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
