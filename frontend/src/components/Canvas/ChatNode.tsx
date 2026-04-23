import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NodeProps } from '@xyflow/react'
import { ChevronDown, Check } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import ChatNodeMessages from './ChatNodeMessages'
import ChatNodeInput from './ChatNodeInput'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'
import type { ModelInfo } from '../../types'

interface ChatNodeData {
  label: string
  model_id: number
  db_node_id: number
  project_id: number
}

export default function ChatNode({ data, selected }: NodeProps) {
  const { label, model_id, db_node_id, project_id } = data as unknown as ChatNodeData
  const { models, updateNodeLabel, updateNodeModel, removeNode } = useCanvasStore()
  const { messages, streaming, loading, errors, loadMessages, sendMessage, cancelStream } = useChatStore()

  const nodeMessages = messages[db_node_id] || []
  const nodeStreaming = streaming[db_node_id] || ''
  const isStreaming = db_node_id in streaming
  const isLoading = loading[db_node_id] || false
  const nodeError = errors[db_node_id]

  useEffect(() => {
    loadMessages(project_id, db_node_id)
  }, [db_node_id, project_id, loadMessages])

  return (
    <div
      className={`bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
      style={{ width: 'min(400px, 90vw)', minHeight: 400, maxHeight: 700 }}
    >
      <ChatNodeHeader
        label={label}
        onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
        onDelete={() => removeNode(db_node_id)}
      />
      {nodeError && (
        <div className="bg-danger-muted border-b border-danger/20 px-3 py-2 text-danger text-xs">
          {nodeError}
        </div>
      )}
      {isLoading && nodeMessages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
          加载消息中...
        </div>
      )}
      {(!isLoading || nodeMessages.length > 0) && (
        <ChatNodeMessages messages={nodeMessages} streaming={nodeStreaming} />
      )}
      <ModelSelector
        value={model_id}
        models={models}
        onChange={(id) => updateNodeModel(db_node_id, id)}
      />
      <ChatNodeInput
        onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
        disabled={isStreaming}
        streaming={isStreaming}
        onStop={() => cancelStream(db_node_id)}
      />
    </div>
  )
}

interface ModelSelectorProps {
  value: number
  models: ModelInfo[]
  onChange: (modelId: number) => void
}

function ModelSelector({ value, models, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect())
    } else {
      setRect(null)
    }
  }, [open])

  const current = models.find((m) => m.id === value)

  return (
    <div className="px-3 pb-2">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-bg-input text-text-primary text-sm rounded px-3 py-1.5 outline-none transition-ui border border-border hover:border-border-hover"
      >
        <span>{current?.display_name || '选择模型'}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          className="bg-bg-elevated border border-border-strong rounded-lg shadow-popover overflow-hidden z-[9999]"
          style={{
            position: 'fixed',
            left: rect.left,
            bottom: window.innerHeight - rect.top + 4,
            width: rect.width,
          }}
        >
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => { onChange(m.id); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-ui"
            >
              <span>{m.display_name}</span>
              {m.id === value && <Check size={14} className="text-brand" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
