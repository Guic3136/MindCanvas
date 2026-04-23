import { useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { Play, Loader2 } from 'lucide-react'
import ChatNodeHeader from './ChatNodeHeader'
import { useCanvasStore } from '../../stores/canvasStore'
import client from '../../api/client'
import { toast } from 'sonner'

interface CodeNodeData {
  label: string
  db_node_id: number
  project_id: number
  code_language?: string
  code_script?: string
  code_output?: string
}

export default function CodeNode({ data, selected, width, height }: NodeProps) {
  const { label, db_node_id, project_id, code_language, code_script, code_output } = data as unknown as CodeNodeData
  const { updateNodeLabel, updateNodeSize, removeNode } = useCanvasStore()

  const [language, setLanguage] = useState(code_language || 'python')
  const [script, setScript] = useState(code_script || '')
  const [output, setOutput] = useState(code_output || '')
  const [running, setRunning] = useState(false)

  const handleRun = useCallback(async () => {
    if (!script.trim()) {
      toast.error('请输入代码')
      return
    }
    setRunning(true)
    try {
      await client.put(`/projects/${project_id}/nodes/${db_node_id}`, {
        code_language: language,
        code_script: script,
      })
      const { data: resp } = await client.post(`/projects/${project_id}/nodes/${db_node_id}/run-code`, {
        language,
        script: script.trim(),
      })
      setOutput(resp.output)
      toast.success('执行完成')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '执行失败'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }, [project_id, db_node_id, language, script])

  return (
    <>
      <NodeResizer
        minWidth={320}
        minHeight={240}
        isVisible={selected}
        onResizeEnd={(_event, params) => {
          updateNodeSize(db_node_id, { width: params.width, height: params.height })
        }}
      />
      <div
        className={`bg-bg-raised border rounded-lg shadow-raised flex flex-col inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
        style={{ width: width || 400, height: height || 360, minHeight: 240 }}
      >
        <ChatNodeHeader
          label={label}
          onLabelChange={(newLabel) => updateNodeLabel(db_node_id, newLabel)}
          onDelete={() => removeNode(db_node_id)}
        />

        {/* Language selector + run button */}
        <div className="px-3 py-2 flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-bg-input text-text-primary text-sm rounded px-2 py-1 outline-none border border-border"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
          </select>
          <button
            onClick={handleRun}
            disabled={running}
            aria-label="运行代码"
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-sm rounded transition-ui disabled:opacity-50"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
        </div>

        {/* Code editor */}
        <div className="px-3 pb-2 flex-1 min-h-0">
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={`输入 ${language} 代码...`}
            className="w-full h-full bg-bg-surface text-text-primary text-sm font-mono rounded p-3 resize-none outline-none border border-border"
            spellCheck={false}
          />
        </div>

        {/* Output */}
        {output && (
          <div className="px-3 pb-3">
            <div className="bg-bg-surface border border-border rounded p-3 text-text-secondary text-xs font-mono whitespace-pre-wrap max-h-32 overflow-auto">
              {output}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
