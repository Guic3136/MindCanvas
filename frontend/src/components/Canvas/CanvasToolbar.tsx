import { Plus, Download } from 'lucide-react'

interface Props {
  projectName: string
  onAddNode: () => void
  onExport: () => void
  onProjectNameChange: (name: string) => void
}

export default function CanvasToolbar({ projectName, onAddNode, onExport, onProjectNameChange }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 sm:px-4 py-2 glass border-b border-border" role="toolbar" aria-label="画布工具栏">
      <div className="flex items-center gap-2">
        <a href="/" className="text-text-muted hover:text-text-secondary text-sm" title="返回项目列表" aria-label="返回项目列表">
          &#8592;
        </a>
        <input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onBlur={(e) => onProjectNameChange(e.target.value)}
          className="bg-transparent text-text-primary text-sm font-semibold outline-none border-b border-transparent focus:border-brand px-1 max-w-[120px] sm:max-w-none truncate"
          aria-label="项目名称"
        />
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <button onClick={onAddNode} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse text-sm rounded transition-ui" aria-label="新建节点">
          <Plus size={16} /> <span className="hidden sm:inline">新建节点</span>
        </button>
        <button onClick={onExport} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-bg-surface hover:bg-bg-hover text-text-primary text-sm rounded border border-border transition-ui" aria-label="导出为 Markdown">
          <Download size={16} /> <span className="hidden sm:inline">导出</span>
        </button>
      </div>
    </div>
  )
}
