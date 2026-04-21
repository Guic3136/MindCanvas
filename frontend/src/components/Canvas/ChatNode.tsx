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
  const { messages, streaming, loadMessages, sendMessage } = useChatStore()

  const nodeMessages = messages[db_node_id] || []
  const nodeStreaming = streaming[db_node_id] || ''
  const isStreaming = db_node_id in streaming

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
      <ChatNodeMessages messages={nodeMessages} streaming={nodeStreaming} />
      <ChatNodeInput
        onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
        disabled={isStreaming}
      />
    </div>
  )
}
