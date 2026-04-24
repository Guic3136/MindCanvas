import { useCallback, useState, useRef } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { Play, Loader2, Check } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import client from '../../api/client'
import { toast } from 'sonner'

interface CompareNodeData {
  label: string
  db_node_id: number
  project_id: number
  compare_model_ids?: string
}

interface StreamState {
  text: string
  done: boolean
  error?: string
}

export default function CompareNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, db_node_id, project_id, compare_model_ids } = data as unknown as CompareNodeData
  const { models, updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [selectedIds, setSelectedIds] = useState<number[]>(
    compare_model_ids ? JSON.parse(compare_model_ids) : []
  )
  const [streams, setStreams] = useState<Record<number, StreamState>>({})
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const toggleModel = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      if (next.length > 3) {
        toast.error('最多选择 3 个模型')
        return prev
      }
      return next
    })
  }, [])

  const handleCompare = useCallback(async () => {
    if (selectedIds.length < 2) {
      toast.error('请至少选择 2 个模型')
      return
    }
    setRunning(true)
    setStreams({})

    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
        compare_model_ids: JSON.stringify(selectedIds),
      })
    } catch (err) {
      toast.error('保存模型选择失败')
      setRunning(false)
      return
    }

    const abort = new AbortController()
    abortRef.current = abort

    try {
      const resp = await fetch(
        `/api/projects/${project_id}/nodes/${db_node_id}/compare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model_ids: selectedIds }),
          signal: abort.signal,
        }
      )
      if (!resp.ok) {
        const err = await resp.json()
        toast.error(err.detail || '对比失败')
        setRunning(false)
        return
      }

      const reader = resp.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6)
            try {
              const item = JSON.parse(jsonStr)
              if (item.type === 'all_done') {
                setRunning(false)
                continue
              }

              const mid = item.model_id
              setStreams((prev) => {
                const existing = prev[mid] || { text: '', done: false }
                if (item.chunk) {
                  return { ...prev, [mid]: { ...existing, text: existing.text + item.chunk } }
                }
                if (item.done) {
                  return { ...prev, [mid]: { ...existing, done: true } }
                }
                if (item.error) {
                  return { ...prev, [mid]: { ...existing, done: true, error: item.error } }
                }
                return prev
              })
            } catch {
              // ignore invalid JSON
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || '对比失败')
      }
    } finally {
      setRunning(false)
      abortRef.current = null
    }
  }, [project_id, db_node_id, selectedIds])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
    setRunning(false)
  }, [])

  return (
    <>
      <NodeResizer
        minWidth={360}
        minHeight={200}
        isVisible={selected}
        onResizeEnd={(_event, params) => {
          updateNodeSize(db_node_id, { width: params.width, height: params.height })
        }}
      />
      <div
        className={`relative bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
        style={{ width: width || 480, height: height || 360, minHeight: 200 }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg" style={{ backgroundColor: nodeColor }} />
        <ChatNodeHeader
          label={label}
          onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
          onDelete={() => removeNode(db_node_id)}
        />

        {/* Model selection */}
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
          {models.map((m) => (
            <button
              key={m.id}
              onClick={() => toggleModel(m.id)}
              disabled={running}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-ui ${
                selectedIds.includes(m.id)
                  ? 'bg-brand/20 border-brand text-brand'
                  : 'bg-bg-surface border-border text-text-muted hover:text-text-secondary'
              } disabled:opacity-50`}
            >
              {selectedIds.includes(m.id) && <Check size={10} />}
              {m.display_name}
            </button>
          ))}
          <button
            onClick={running ? handleCancel : handleCompare}
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-xs rounded transition-ui disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto min-h-0 px-3 pb-3">
          {selectedIds.length > 0 && Object.keys(streams).length > 0 ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedIds.length}, minmax(0, 1fr))` }}>
              {selectedIds.map((id) => {
                const model = models.find((m) => m.id === id)
                const stream = streams[id]
                return (
                  <div key={id} className="bg-bg-surface border border-border rounded p-2 flex flex-col min-h-0">
                    <div className="text-brand text-xs font-semibold mb-1 flex items-center gap-1">
                      {model?.display_name}
                      {stream?.done && !stream?.error && <Check size={10} />}
                      {!stream?.done && running && <Loader2 size={10} className="animate-spin" />}
                    </div>
                    <div className="text-text-secondary text-xs whitespace-pre-wrap overflow-auto flex-1 min-h-0">
                      {stream?.error ? (
                        <span className="text-red-400">[错误: {stream.error}]</span>
                      ) : (
                        stream?.text || ''
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              选择模型并点击对比按钮
            </div>
          )}
        </div>
      </div>
    </>
  )
}
