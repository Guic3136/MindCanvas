import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer, Handle, Position } from '@xyflow/react'
import { Play, Loader2, ChevronDown, Check } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import { useCanvasStore } from '../../stores/canvasStore'
import { nodeRegistry, type NodeType } from './nodeRegistry'
import type { ModelInfo } from '../../types'
import client from '../../api/client'
import { toast } from 'sonner'

interface TransformNodeData {
  label: string
  db_node_id: number
  project_id: number
  model_id?: number
  transform_prompt?: string
  transform_output?: string
  transform_format?: string
  merge_strategy?: string
  self_critique?: boolean
  max_iterations?: number
  batch_mode?: boolean
  routing_rules?: string
}

const FORMAT_OPTIONS = [
  { value: 'text', label: '文本' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown_table', label: 'Markdown 表格' },
]

const MERGE_OPTIONS = [
  { value: 'concat', label: '拼接' },
  { value: 'summarize', label: '摘要' },
  { value: 'diff', label: '差异' },
]

export default function TransformNode({ data, selected, width, height, type }: NodeProps) {
  const nodeColor = nodeRegistry[(type as NodeType) ?? 'chat']?.color
  const {
    label,
    db_node_id,
    project_id,
    model_id,
    transform_prompt,
    transform_output,
    transform_format,
    merge_strategy,
    self_critique,
    max_iterations,
    batch_mode,
    routing_rules,
  } = data as unknown as TransformNodeData
  const { models, updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [prompt, setPrompt] = useState(transform_prompt || '')
  const [output, setOutput] = useState(transform_output || '')
  const [running, setRunning] = useState(false)

  const [format, setFormat] = useState(transform_format || 'text')
  const [merge, setMerge] = useState(merge_strategy || 'concat')
  const [critique, setCritique] = useState(self_critique || false)
  const [iterations, setIterations] = useState(max_iterations ?? 3)
  const [selectedModel, setSelectedModel] = useState(model_id || (models[0]?.id ?? 0))
  const [batchMode, setBatchMode] = useState(batch_mode || false)
  const [routingRules, setRoutingRules] = useState(routing_rules || '')

  useEffect(() => {
    setPrompt(transform_prompt || '')
    setOutput(transform_output || '')
    setFormat(transform_format || 'text')
    setMerge(merge_strategy || 'concat')
    setCritique(self_critique || false)
    setIterations(max_iterations ?? 3)
    setSelectedModel(model_id || (models[0]?.id ?? 0))
    setBatchMode(batch_mode || false)
    setRoutingRules(routing_rules || '')
  }, [transform_prompt, transform_output, transform_format, merge_strategy, self_critique, max_iterations, model_id, models, batch_mode, routing_rules])

  const saveField = useCallback(
    async (field: string, value: unknown) => {
      try {
        await client.put(`/projects/${project_id}/nodes/${db_node_id}`, { [field]: value })
      } catch {
        toast.error('保存失败')
      }
    },
    [project_id, db_node_id]
  )

  const handleFormatChange = useCallback(
    (value: string) => {
      setFormat(value)
      saveField('transform_format', value)
    },
    [saveField]
  )

  const handleMergeChange = useCallback(
    (value: string) => {
      setMerge(value)
      saveField('merge_strategy', value)
    },
    [saveField]
  )

  const handleCritiqueChange = useCallback(
    (value: boolean) => {
      setCritique(value)
      saveField('self_critique', value)
    },
    [saveField]
  )

  const handleIterationsChange = useCallback(
    (value: number) => {
      setIterations(value)
      saveField('max_iterations', value)
    },
    [saveField]
  )

  const handleModelChange = useCallback(
    (id: number) => {
      setSelectedModel(id)
      saveField('model_id', id)
    },
    [saveField]
  )

  const handleBatchModeChange = useCallback(
    (value: boolean) => {
      setBatchMode(value)
      saveField('batch_mode', value)
    },
    [saveField]
  )

  const handleRoutingRulesChange = useCallback(
    (value: string) => {
      setRoutingRules(value)
      saveField('routing_rules', value)
    },
    [saveField]
  )

  const handleRun = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error('请输入转换指令')
      return
    }
    setRunning(true)
    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
        transform_prompt: prompt.trim(),
        transform_format: format,
        merge_strategy: merge,
        self_critique: critique,
        max_iterations: iterations,
        model_id: selectedModel,
        batch_mode: batchMode,
        routing_rules: routingRules,
      })
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
  }, [project_id, db_node_id, prompt, format, merge, critique, iterations, selectedModel, batchMode, routingRules])

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

        {/* Model selector */}
        <div className="px-3 pb-2">
          <ModelSelector value={selectedModel} models={models} onChange={handleModelChange} />
        </div>

        {/* Prompt textarea */}
        <div className="px-3 pb-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="转换指令，如：翻译成英文、提取关键词..."
            rows={3}
            className="w-full bg-bg-input text-text-primary text-sm rounded px-3 py-2 outline-none border border-border resize-none"
          />
          <div className="mt-1 text-xs text-text-muted">支持模板语法: {'{{变量名}}'}</div>
        </div>

        {/* Settings row */}
        <div className="px-3 pb-2 flex gap-2">
          <SelectDropdown
            label="输出格式"
            value={format}
            options={FORMAT_OPTIONS}
            onChange={handleFormatChange}
          />
          <SelectDropdown
            label="合并策略"
            value={merge}
            options={MERGE_OPTIONS}
            onChange={handleMergeChange}
          />
        </div>

        {/* Self-critique */}
        <div className="px-3 pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={critique}
              onChange={(e) => handleCritiqueChange(e.target.checked)}
              className="rounded border-border bg-bg-input text-brand focus:ring-brand"
            />
            <span className="text-sm text-text-primary">自我评估</span>
          </label>
          {critique && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-text-secondary">最大迭代次数</span>
              <input
                type="number"
                min={1}
                max={5}
                value={iterations}
                onChange={(e) => {
                  const v = Math.min(5, Math.max(1, Number(e.target.value)))
                  handleIterationsChange(v)
                }}
                className="w-16 bg-bg-input text-text-primary text-sm rounded px-2 py-1 outline-none border border-border"
              />
            </div>
          )}
        </div>

        {/* Batch mode */}
        <div className="px-3 pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={batchMode}
              onChange={(e) => handleBatchModeChange(e.target.checked)}
              className="rounded border-border bg-bg-input text-brand focus:ring-brand"
            />
            <span className="text-sm text-text-primary">批量模式</span>
          </label>
          <div className="mt-1 text-xs text-text-muted">上游为 JSON 数组时逐项处理</div>
        </div>

        {/* Routing rules */}
        <div className="px-3 pb-2">
          <div className="text-xs text-text-muted mb-1">路由规则（可选）</div>
          <textarea
            value={routingRules}
            onChange={(e) => handleRoutingRulesChange(e.target.value)}
            placeholder={`通过,批准 -> a\n拒绝,驳回 -> b\ndefault -> c`}
            rows={2}
            className="w-full bg-bg-input text-text-primary text-sm rounded px-3 py-2 outline-none border border-border resize-none"
          />
        </div>

        {/* Output handles */}
        <Handle type="source" position={Position.Right} id="a" style={{ top: '35%', background: '#4ec2ef' }} />
        <Handle type="source" position={Position.Right} id="b" style={{ top: '50%', background: '#ef8a4e' }} />
        <Handle type="source" position={Position.Right} id="c" style={{ top: '65%', background: '#c2ef4e' }} />

        {/* Run button */}
        <div className="px-3 pb-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-sm rounded transition-ui disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{running ? '转换中...' : '执行转换'}</span>
          </button>
        </div>

        {/* Output */}
        <div className="flex-1 overflow-auto min-h-0 px-3 pb-3">
          {output ? (
            <OutputDisplay output={output} format={format} />
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

function OutputDisplay({ output, format }: { output: string; format: string }) {
  if (format === 'json') {
    try {
      const parsed = JSON.parse(output)
      return (
        <pre className="bg-bg-surface border border-border rounded p-3 text-text-secondary text-sm overflow-auto">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )
    } catch {
      // fall through to plain text
    }
  }
  if (format === 'markdown_table') {
    return (
      <div className="bg-bg-surface border border-border rounded p-3 text-text-secondary text-sm overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {output.split('\n').map((line, i) => (
              <tr key={i} className={line.startsWith('|') ? '' : 'hidden'}>
                {line.split('|').filter(Boolean).map((cell, j) => (
                  <td key={j} className="border border-border px-2 py-1">
                    {cell.trim()}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!output.includes('|') && <pre className="whitespace-pre-wrap">{output}</pre>}
      </div>
    )
  }
  return (
    <div className="bg-bg-surface border border-border rounded p-3 text-text-secondary text-sm whitespace-pre-wrap">
      {output}
    </div>
  )
}

interface SelectOption {
  value: string
  label: string
}

interface SelectDropdownProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
}

function SelectDropdown({ label, value, options, onChange }: SelectDropdownProps) {
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

  const current = options.find((o) => o.value === value)

  return (
    <div className="flex-1">
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between bg-bg-input text-text-primary text-sm rounded px-3 py-1.5 outline-none transition-ui border border-border hover:border-border-hover"
      >
        <span>{current?.label}</span>
        <ChevronDown size={14} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && createPortal(
        <div
          ref={dropdownRef}
          className="bg-bg-elevated border border-border-strong rounded-lg shadow-popover overflow-hidden z-[9999]"
          style={{
            position: 'fixed',
            left: rect.left,
            top: rect.bottom + 4,
            width: rect.width,
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-ui"
            >
              <span>{o.label}</span>
              {o.value === value && <Check size={14} className="text-brand" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

interface ModelSelectorProps {
  value: number
  models: ModelInfo[]
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
            top: rect.bottom + 4,
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
