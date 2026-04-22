import { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Pencil, Check, Trash2 } from 'lucide-react'

interface Props {
  label: string
  onLabelChange: (label: string) => void
  onDelete?: () => void
}

export default function ChatNodeHeader({ label, onLabelChange, onDelete }: Props) {
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
      {editing ? (
        <div className="flex items-center gap-1 flex-1">
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
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="text-text-muted hover:text-danger transition-ui" aria-label="删除节点">
          <Trash2 size={14} />
        </button>
      )}
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-brand !border-2 !border-bg-raised" />
    </div>
  )
}
