import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Pencil, Check } from 'lucide-react'
import type { ModelInfo } from '../../types'

interface Props {
  label: string
  modelId: number
  models: ModelInfo[]
  onLabelChange: (label: string) => void
  onModelChange: (modelId: number) => void
}

export default function ChatNodeHeader({ label, modelId, models, onLabelChange, onModelChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(label)

  const handleLabelSubmit = () => {
    setEditing(false)
    if (editLabel.trim() && editLabel !== label) {
      onLabelChange(editLabel.trim())
    }
  }

  return (
    <div className="flex items-center gap-2 p-3 border-b border-gray-700 bg-gray-800/50">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-blue-500 !border-2 !border-gray-900" />
      <select
        value={modelId}
        onChange={(e) => onModelChange(Number(e.target.value))}
        className="flex-1 bg-gray-700 text-white text-sm rounded px-2 py-1 outline-none"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>{m.display_name}</option>
        ))}
      </select>
      {editing ? (
        <div className="flex items-center gap-1">
          <input
            value={editLabel}
            onChange={(e) => setEditLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLabelSubmit()}
            className="bg-gray-700 text-white text-sm rounded px-2 py-1 w-24 outline-none"
            autoFocus
          />
          <button onClick={handleLabelSubmit} className="text-green-400 hover:text-green-300">
            <Check size={14} />
          </button>
        </div>
      ) : (
        <button onClick={() => { setEditLabel(label); setEditing(true) }} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm">
          {label} <Pencil size={12} />
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-green-500 !border-2 !border-gray-900" />
    </div>
  )
}
