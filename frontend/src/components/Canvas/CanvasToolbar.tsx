import { Plus, Download } from 'lucide-react'

interface Props {
  projectName: string
  onAddNode: () => void
  onExport: () => void
  onProjectNameChange: (name: string) => void
}

export default function CanvasToolbar({ projectName, onAddNode, onExport, onProjectNameChange }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/90 border-b border-gray-700 backdrop-blur">
      <div className="flex items-center gap-3">
        <a href="/" className="text-white font-bold text-lg hover:text-blue-400">MindCanvas</a>
        <span className="text-gray-500">/</span>
        <input
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          onBlur={(e) => onProjectNameChange(e.target.value)}
          className="bg-transparent text-white text-sm font-medium outline-none border-b border-transparent focus:border-blue-500 px-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onAddNode} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded">
          <Plus size={16} /> 新建节点
        </button>
        <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded">
          <Download size={16} /> 导出
        </button>
      </div>
    </div>
  )
}
