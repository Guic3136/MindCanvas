import { useEffect } from 'react'
import type { NodeProps } from '@xyflow/react'
import ChatNodeHeader from './ChatNodeHeader'
import ChatNodeMessages from './ChatNodeMessages'
import ChatNodeInput from './ChatNodeInput'
import { useCanvasStore } from '../../stores/canvasStore'
import { useChatStore } from '../../stores/chatStore'

interface ChatNodeData {
  label: string
  model_id: number
  db_node_id: number
  project_id: number
}

export default function ChatNode({ data, selected }: NodeProps) {
  const { label, model_id, db_node_id, project_id } = data as unknown as ChatNodeData
  const { models, updateNodeLabel, updateNodeModel } = useCanvasStore()
  const { messages, streaming, loading, errors, loadMessages, sendMessage } = useChatStore()

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
      style={{ width: 'min(400px, 90vw)', height: 500 }}
    >
      <ChatNodeHeader
        label={label}
        onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
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
      <div className="px-3 pb-2">
        <select
          value={model_id}
          onChange={(e) => updateNodeModel(db_node_id, Number(e.target.value))}
          className="w-full bg-bg-input text-text-primary text-sm rounded px-2 py-1.5 outline-none transition-ui border border-border"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.display_name}</option>
          ))}
        </select>
      </div>
      <ChatNodeInput
        onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
        disabled={isStreaming}
      />
    </div>
  )
}
