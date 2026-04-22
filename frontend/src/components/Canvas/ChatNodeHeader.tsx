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
    <div className="flex items-center gap-2 p-3 border-b border-border bg-bg-surface/60 inset-highlight">
      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-brand !border-2 !border-bg-raised" />
      <select
        value={modelId}
        onChange={(e) => onModelChange(Number(e.target.value))}
        className="flex-1 bg-bg-input text-text-primary text-sm rounded px-2 py-1 outline-none transition-ui"
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
            className="bg-bg-input text-text-primary text-sm rounded px-2 py-1 w-24 outline-none"
            autoFocus
          />
          <button onClick={handleLabelSubmit} className="text-brand hover:text-brand-hover transition-ui">
            <Check size={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => { setEditLabel(label); setEditing(true) }} className="flex items-center gap-1 text-text-secondary hover:text-text-primary text-sm transition-ui">
          {label} <Pencil size={14} />
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-brand !border-2 !border-bg-raised" />
    </div>
  )
}
