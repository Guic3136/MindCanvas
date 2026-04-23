import { Plus, Download, ZoomIn, ZoomOut, Maximize, Minus, Plus as PlusIcon } from 'lucide-react'

interface Props {
  projectName: string
  onAddNode: () => void
  onExport: () => void
  onProjectNameChange: (name: string) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFitView: () => void
  onFullscreen: () => void
  nodeCount: number
  edgeCount: number
}

export default function CanvasToolbar({
  projectName, onAddNode, onExport, onProjectNameChange,
  zoom, onZoomIn, onZoomOut, onFitView, onFullscreen,
  nodeCount, edgeCount,
}: Props) {
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
        <span className="text-text-muted text-xs hidden md:inline">
          {nodeCount} 节点 · {edgeCount} 连线
        </span>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 border border-border rounded px-1 py-0.5 mr-1">
          <button onClick={onZoomOut} className="p-1 text-text-muted hover:text-text-primary transition-ui" title="缩小" aria-label="缩小">
            <ZoomOut size={14} />
          </button>
          <button
            onClick={onFitView}
            className="px-1.5 text-text-muted hover:text-text-primary text-xs font-mono transition-ui min-w-[42px] text-center"
            title="适应视图"
            aria-label="适应视图"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={onZoomIn} className="p-1 text-text-muted hover:text-text-primary transition-ui" title="放大" aria-label="放大">
            <ZoomIn size={14} />
          </button>
        </div>
        <button onClick={onFullscreen} className="p-1.5 text-text-muted hover:text-text-primary transition-ui hidden sm:block" title="全屏" aria-label="全屏">
          <Maximize size={14} />
        </button>
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
