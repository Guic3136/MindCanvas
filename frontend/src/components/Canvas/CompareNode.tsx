import { useCallback, useState } from 'react'
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

export default function CompareNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, db_node_id, project_id, compare_model_ids } = data as unknown as CompareNodeData
  const { models, updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [selectedIds, setSelectedIds] = useState<number[]>(
    compare_model_ids ? JSON.parse(compare_model_ids) : []
  )
  const [results, setResults] = useState<Record<number, string>>({})
  const [running, setRunning] = useState(false)

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
    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
        compare_model_ids: JSON.stringify(selectedIds),
      })
      const { data: resp } = await client.post(`/projects/${project_id}/nodes/${db_node_id}/compare`, {
        model_ids: selectedIds,
      })
      setResults(resp.results)
    } catch (err) {
      const msg = err instanceof Error ? err.message : '对比失败'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }, [project_id, db_node_id, selectedIds])

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
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-ui ${
                selectedIds.includes(m.id)
                  ? 'bg-brand/20 border-brand text-brand'
                  : 'bg-bg-surface border-border text-text-muted hover:text-text-secondary'
              }`}
            >
              {selectedIds.includes(m.id) && <Check size={10} />}
              {m.display_name}
            </button>
          ))}
          <button
            onClick={handleCompare}
            disabled={running}
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-xs rounded transition-ui disabled:opacity-50"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto min-h-0 px-3 pb-3">
          {Object.keys(results).length > 0 ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${selectedIds.length}, minmax(0, 1fr))` }}>
              {selectedIds.map((id) => {
                const model = models.find((m) => m.id === id)
                return (
                  <div key={id} className="bg-bg-surface border border-border rounded p-2">
                    <div className="text-brand text-xs font-semibold mb-1">{model?.display_name}</div>
                    <div className="text-text-secondary text-xs whitespace-pre-wrap">{results[id]}</div>
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
