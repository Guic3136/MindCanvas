import { useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { nodeRegistry, nodeCategories } from './nodeRegistry'

interface Props {
  onAddNode: (nodeType: string) => void
}

export default function NodeTypePanel({ onAddNode }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const handleAdd = useCallback((type: string) => {
    onAddNode(type)
  }, [onAddNode])

  return (
    <div
      className={`absolute left-0 top-12 bottom-0 z-10 bg-bg-raised border-r border-border flex flex-col transition-all duration-200 ${collapsed ? 'w-11' : 'w-[200px]'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        {!collapsed && <span className="text-text-secondary text-xs font-semibold tracking-wide">节点类型</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-text-muted hover:text-text-primary transition-ui"
          aria-label={collapsed ? '展开面板' : '收起面板'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Type list */}
      <div className="flex-1 overflow-y-auto py-2">
        {nodeCategories.map((cat) => {
          const types = Object.entries(nodeRegistry).filter(([, meta]) => meta.category === cat.key)
          if (types.length === 0) return null
          return (
            <div key={cat.key} className="mb-3">
              {!collapsed && (
                <div className="px-3 py-1 text-text-muted text-[10px] font-semibold uppercase tracking-wider">
                  {cat.label}
                </div>
              )}
              {types.map(([type, meta]) => {
                const Icon = meta.icon
                return (
                  <button
                    key={type}
                    onClick={() => handleAdd(type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-ui group"
                    title={collapsed ? meta.label : meta.description}
                  >
                    <Icon size={16} className="shrink-0 text-text-muted group-hover:text-brand transition-ui" />
                    {!collapsed && (
                      <div className="text-left">
                        <div className="text-sm">{meta.label}</div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
