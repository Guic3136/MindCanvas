import { useCallback, useEffect, useRef, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { Upload, FileText, X } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import ChatNodeInput from './ChatNodeInput'
import FilePreview from './FilePreview'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import { useChatStore } from '../../stores/chatStore'
import client from '../../api/client'
import { toast } from 'sonner'

interface FileNodeData {
  label: string
  model_id: number
  db_node_id: number
  project_id: number
  node_type: string
  file_url?: string
  file_name?: string
  file_type?: string
}

export default function FileNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const {
    label, model_id, db_node_id, project_id,
    file_url, file_name, file_type,
  } = data as unknown as FileNodeData

  const { models, updateNodeLabel, updateNodeModel, updateNodeSize, removeNode } = useCanvasStore()
  const { messages, streaming, loading, errors, loadMessages, sendMessage, cancelStream } = useChatStore()

  const nodeMessages = messages[db_node_id] || []
  const nodeStreaming = streaming[db_node_id] || ''
  const isStreaming = db_node_id in streaming
  const isLoading = loading[db_node_id] || false
  const nodeError = errors[db_node_id]

  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data: result } = await client.post(`/projects/${project_id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
        file_url: result.url,
        file_name: result.name,
        file_type: result.type,
      })
      toast.success('文件上传成功')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '上传失败'
      toast.error(msg)
    } finally {
      setUploading(false)
    }
  }, [project_id, db_node_id])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }, [handleUpload])

  const hasFile = !!file_url

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

        {/* File upload or preview area */}
        <div className="flex-1 overflow-hidden min-h-0">
          {!hasFile ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="h-full flex flex-col items-center justify-center gap-3 p-6 cursor-pointer border-2 border-dashed border-border hover:border-brand/50 rounded-lg m-3 transition-ui"
            >
              <Upload size={32} className="text-text-muted" />
              <div className="text-text-secondary text-sm text-center">
                <p>点击或拖拽上传文件</p>
                <p className="text-text-muted text-xs mt-1">支持图片、PDF、Excel</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            <div className="h-full flex flex-col m-3 border border-border rounded bg-bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-input">
                <div className="flex items-center gap-2 text-text-secondary text-xs truncate">
                  <FileText size={14} />
                  <span className="truncate">{file_name}</span>
                </div>
                <button
                  onClick={() => {
                    client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
                      file_url: null, file_name: null, file_type: null,
                    }).catch(() => {})
                  }}
                  className="text-text-muted hover:text-danger transition-ui"
                  title="移除文件"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
                <FilePreview fileUrl={file_url} fileType={file_type || ''} fileName={file_name || ''} />
              </div>
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-bg/60 flex items-center justify-center rounded-lg z-10">
              <div className="spinner-refined" role="status" />
            </div>
          )}
        </div>

        {/* Model selector */}
        {hasFile && (
          <div className="px-3 pb-2">
            <ModelSelector value={model_id} models={models} onChange={(id) => updateNodeModel(db_node_id, id)} />
          </div>
        )}

        {/* Chat input */}
        {hasFile && (
          <ChatNodeInput
            onSend={(msg) => sendMessage(project_id, db_node_id, msg)}
            disabled={isStreaming}
            streaming={isStreaming}
            onStop={() => cancelStream(db_node_id)}
          />
        )}
      </div>
    </>
  )
}

// Re-use ModelSelector from ChatNode
// Since we can't import it (it's defined locally in ChatNode), copy it here
import { ChevronDown, Check } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ModelSelectorProps {
  value: number
  models: { id: number; display_name: string }[]
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
    <div>
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
