import { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { ImagePlus, Loader2 } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import client from '../../api/client'
import { toast } from 'sonner'

interface ImageGenNodeData {
  label: string
  db_node_id: number
  project_id: number
  image_gen_prompt?: string
  image_gen_url?: string
}

export default function ImageGenNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, db_node_id, project_id, image_gen_prompt, image_gen_url } = data as unknown as ImageGenNodeData
  const { updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [prompt, setPrompt] = useState(image_gen_prompt || '')
  const [imageUrl, setImageUrl] = useState(image_gen_url || '')
  const [generating, setGenerating] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('请输入提示词')
      return
    }
    setGenerating(true)
    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
        image_gen_prompt: prompt.trim(),
      })
      const { data: resp } = await client.post(`/projects/${project_id}/nodes/${db_node_id}/generate-image`, {
        prompt: prompt.trim(),
      })
      setImageUrl(resp.url)
      toast.success('图片生成成功')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败'
      toast.error(msg)
    } finally {
      setGenerating(false)
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
        style={{ width: width || 360, height: height || 400, minHeight: 200 }}
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
            placeholder="描述你想生成的图片..."
            className="flex-1 bg-bg-input text-text-primary text-sm rounded px-3 py-1.5 outline-none border border-border"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            aria-label="生成图片"
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-sm rounded transition-ui disabled:opacity-50"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          </button>
        </div>

        {/* Image display */}
        <div className="flex-1 overflow-hidden min-h-0 px-3 pb-3 flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Generated"
              className="max-w-full max-h-full object-contain rounded"
            />
          ) : (
            <div className="text-text-muted text-sm">
              输入提示词并点击生成按钮
            </div>
          )}
        </div>
      </div>
    </>
  )
}
