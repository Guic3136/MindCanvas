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
      className={`bg-gray-900 border rounded-lg shadow-xl flex flex-col ${selected ? 'border-blue-500' : 'border-gray-700'}`}
      style={{ width: 400, height: 500 }}
    >
      <ChatNodeHeader
        label={label}
        modelId={model_id}
        models={models}
        onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
        onModelChange={(newModelId) => updateNodeModel(db_node_id, newModelId)}
      />
      {nodeError && (
        <div className="bg-red-900/50 border-b border-red-700 px-3 py-2 text-red-300 text-xs">
          {nodeError}
        </div>
      )}
      {isLoading && nodeMessages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Loading messages...
        </div>
      )}
      {(!isLoading || nodeMessages.length > 0) && (
        <ChatNodeMessages messages={nodeMessages} streaming={nodeStreaming} />
      )}
      <ChatNodeInput
        onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
        disabled={isStreaming}
      />
    </div>
  )
}
