import { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { ImagePlus, Loader2, Minus, Plus } from 'lucide-react'
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

const SIZE_OPTIONS = ['方形图', '竖屏图', '横屏图']

export default function ImageGenNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const { label, db_node_id, project_id, image_gen_prompt, image_gen_url } = data as unknown as ImageGenNodeData
  const { updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [prompt, setPrompt] = useState(image_gen_prompt || '')
  const [imageUrls, setImageUrls] = useState<string[]>(image_gen_url ? [image_gen_url] : [])
  const [generating, setGenerating] = useState(false)
  const [size, setSize] = useState('方形图')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [imageCount, setImageCount] = useState(1)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
        size,
        negative_prompt: negativePrompt.trim(),
        n: imageCount,
      })
      setImageUrls(resp.urls || [])
      toast.success('图片生成成功')
    } catch (err: any) {
      const msg = err?.response?.data?.detail || (err instanceof Error ? err.message : '生成失败')
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }, [project_id, db_node_id, prompt, size, negativePrompt, imageCount])

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={280}
        isVisible={selected}
        onResizeEnd={(_event, params) => {
          updateNodeSize(db_node_id, { width: params.width, height: params.height })
        }}
      />
      <div
        className={`relative bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
        style={{ width: width || 400, height: height || 480, minHeight: 280 }}
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

        {/* Advanced options */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-text-muted hover:text-text-secondary transition-ui"
          >
            {showAdvanced ? '收起高级选项' : '高级选项'}
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-2">
              {/* Size selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-16">尺寸</span>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="flex-1 bg-bg-input text-text-primary text-xs rounded px-2 py-1 outline-none border border-border"
                >
                  {SIZE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              {/* Image count */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-16">数量</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setImageCount(Math.max(1, imageCount - 1))}
                    className="p-1 rounded bg-bg-input hover:bg-bg-hover transition-ui"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs text-text-primary w-6 text-center">{imageCount}</span>
                  <button
                    onClick={() => setImageCount(Math.min(4, imageCount + 1))}
                    className="p-1 rounded bg-bg-input hover:bg-bg-hover transition-ui"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
              {/* Negative prompt */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted w-16">排除词</span>
                <input
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="不想出现的内容..."
                  className="flex-1 bg-bg-input text-text-primary text-xs rounded px-2 py-1 outline-none border border-border"
                />
              </div>
            </div>
          )}
        </div>

        {/* Image display */}
        <div className="flex-1 overflow-auto min-h-0 px-3 pb-3">
          {imageUrls.length > 0 ? (
            <div className={`grid gap-2 ${imageUrls.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {imageUrls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Generated ${idx + 1}`}
                  className="w-full h-auto object-contain rounded"
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              输入提示词并点击生成按钮
            </div>
          )}
        </div>
      </div>
    </>
  )
}
