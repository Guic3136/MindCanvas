import { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { Play, Loader2 } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import client from '../../api/client'
import { toast } from 'sonner'

interface TransformNodeData {
  label: string
  db_node_id: number
  project_id: number
  transform_prompt?: string
  transform_output?: string
}

export default function TransformNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, db_node_id, project_id, transform_prompt, transform_output } = data as unknown as TransformNodeData
  const { updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [prompt, setPrompt] = useState(transform_prompt || '')
  const [output, setOutput] = useState(transform_output || '')
  const [running, setRunning] = useState(false)

  const handleRun = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('请输入转换指令')
      return
    }
    setRunning(true)
    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, { transform_prompt: prompt.trim() })
      const { data: result } = await client.post(`/projects/${project_id}/nodes/${db_node_id}/transform`, {
        prompt: prompt.trim(),
      })
      setOutput(result.output)
      toast.success('转换完成')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '转换失败'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }, [project_id, db_node_id, prompt])

  return (
    <>
      <NodeResizer
        minWidth={280}
        minHeight={200}
        isVisible={selected}
        onResizeEnd={(_event, params) => {
          updateNodeSize(db_node_id, { width: params.width, height: params.height })
        }}
      />
      <div
        className={`relative bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
        style={{ width: width || 360, height: height || 320, minHeight: 200 }}
      >
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-lg" style={{ backgroundColor: nodeColor }} />
        <ChatNodeHeader
          label={label}
          onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
          onDelete={() => removeNode(db_node_id)}
        />

        {/* Prompt input */}
        <div className="px-3 py-2 flex gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="转换指令，如：翻译成英文、提取关键词..."
            className="flex-1 bg-bg-input text-text-primary text-sm rounded px-3 py-1.5 outline-none border border-border"
          />
          <button
            onClick={handleRun}
            disabled={running}
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-sm rounded transition-ui disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
        </div>

        {/* Output */}
        <div className="flex-1 overflow-auto min-h-0 px-3 pb-3">
          {output ? (
            <div className="bg-bg-surface border border-border rounded p-3 text-text-secondary text-sm whitespace-pre-wrap">
              {output}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              输入指令并点击执行
            </div>
          )}
        </div>
      </div>
    </>
  )
}
