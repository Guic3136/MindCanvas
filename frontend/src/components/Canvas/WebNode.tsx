import { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { Globe, Loader2, RefreshCw } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import ChatNodeInput from './ChatNodeInput'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import { useChatStore } from '../../stores/chatStore'
import client from '../../api/client'
import { toast } from 'sonner'

interface WebNodeData {
  label: string
  model_id: number
  db_node_id: number
  project_id: number
  web_url?: string
  web_content?: string
}

export default function WebNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, model_id, db_node_id, project_id, web_url, web_content } = data as unknown as WebNodeData
  const { models, updateNodeLabel, updateNodeModel, updateNodeSize, removeNode } = useCanvasStore()
  const { messages, streaming, loading, errors, loadMessages, sendMessage, cancelStream } = useChatStore()

  const nodeMessages = messages[db_node_id] || []
  const nodeStreaming = streaming[db_node_id] || ''
  const isStreaming = db_node_id in streaming
  const isLoading = loading[db_node_id] || false
  const nodeError = errors[db_node_id]

  const [url, setUrl] = useState(web_url || '')
  const [fetching, setFetching] = useState(false)

  const handleFetch = useCallback(async () => {
    if (!url.trim()) {
      toast.error('请输入 URL')
      return
    }
    setFetching(true)
    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, { web_url: url.trim() })
      await client.post(`/projects/${project_id}/nodes/${db_node_id}/fetch-web`, { url: url.trim() })
      toast.success('网页抓取成功')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '抓取失败'
      toast.error(msg)
    } finally {
      setFetching(false)
    }
  }, [project_id, db_node_id, url])

  const hasContent = !!web_content

  return (
    <>
      <NodeResizer
        minWidth={280}
        minHeight={250}
        isVisible={selected}
        onResizeEnd={(_event, params) => {
          updateNodeSize(db_node_id, { width: params.width, height: params.height })
        }}
      />
      <div
        className={`relative bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
        style={{ width: width || 400, height: height || 500, minHeight: 250 }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg" style={{ backgroundColor: nodeColor }} />
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

        {/* URL input */}
        <div className="px-3 py-2 flex gap-2">
          <div className="flex-1 flex items-center gap-2 bg-bg-input border border-border rounded px-3 py-1.5">
            <Globe size={14} className="text-text-muted shrink-0" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="输入网页 URL..."
              className="flex-1 bg-transparent text-text-primary text-sm outline-none"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="px-3 py-1.5 bg-bg-surface hover:bg-bg-hover text-text-primary text-sm rounded border border-border transition-ui disabled:opacity-50"
          >
            {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {/* Content preview */}
        <div className="flex-1 overflow-auto min-h-0 px-3 pb-2">
          {hasContent ? (
            <div className="bg-bg-surface border border-border rounded p-3 text-text-secondary text-xs whitespace-pre-wrap">
              {web_content}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              输入 URL 并点击抓取按钮
            </div>
          )}
        </div>

        {/* Chat */}
        {hasContent && (
          <>
            <div className="px-3 pb-2">
              <select
                value={model_id}
                onChange={(e) => updateNodeModel(db_node_id, Number(e.target.value))}
                className="w-full bg-bg-input text-text-primary text-sm rounded px-3 py-1.5 outline-none border border-border"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name}</option>
                ))}
              </select>
            </div>
            <ChatNodeInput
              onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
              disabled={isStreaming}
              streaming={isStreaming}
              onStop={() => cancelStream(db_node_id)}
            />
          </>
        )}
      </div>
    </>
  )
}
