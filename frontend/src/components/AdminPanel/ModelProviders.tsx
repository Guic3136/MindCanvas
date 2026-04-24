import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import * as adminApi from '../../api/admin'
import type { ModelProvider, ModelInfo } from '../../types'

export default function ModelProviders() {
  const [providers, setProviders] = useState<ModelProvider[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [showAddModel, setShowAddModel] = useState<number | null>(null)
  const [newProvider, setNewProvider] = useState({ name: '', base_url: '', api_key: '' })
  const [newModel, setNewModel] = useState({ model_id: '', display_name: '' })

  const load = async () => {
    const [p, m] = await Promise.all([adminApi.listProviders(), adminApi.listModels()])
    setProviders(p.items)
    setModels(m.items)
  }

  useEffect(() => { load() }, [])

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.base_url || !newProvider.api_key) {
      toast.error('请填写所有必填字段')
      return
    }
    await adminApi.createProvider(newProvider)
    setNewProvider({ name: '', base_url: '', api_key: '' })
    setShowAddProvider(false)
    load()
  }

  const handleAddModel = async (providerId: number) => {
    if (!newModel.model_id || !newModel.display_name) {
      toast.error('请填写所有必填字段')
      return
    }
    await adminApi.createModel({ provider_id: providerId, ...newModel })
    setNewModel({ model_id: '', display_name: '' })
    setShowAddModel(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">模型配置</h2>
        <button onClick={() => setShowAddProvider(true)} className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">
          <Plus size={16} /> 添加 Provider
        </button>
      </div>

      {showAddProvider && (
        <div className="bg-bg-raised border border-border rounded-lg p-4 space-y-3 shadow-raised">
          <input value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} placeholder="名称（如：通义千问）" className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input" />
          <input value={newProvider.base_url} onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })} placeholder="API 地址" className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input" />
          <input value={newProvider.api_key} onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })} placeholder="API Key" type="password" className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input" />
          <div className="flex gap-2">
            <button onClick={handleAddProvider} className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">保存</button>
            <button onClick={() => setShowAddProvider(false)} className="px-3 py-1.5 bg-bg-surface hover:bg-bg-hover rounded text-sm text-text-secondary transition-ui">取消</button>
          </div>
        </div>
      )}

      {providers.map((p) => (
        <div key={p.id} className="bg-bg-raised border border-border rounded-lg shadow-raised">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setExpanded({ ...expanded, [p.id]: !expanded[p.id] })} className="flex items-center gap-2 text-left">
              {expanded[p.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-medium text-text-primary">{p.name}</span>
              <span className="text-text-muted text-sm">{p.base_url}</span>
              <span className="text-text-muted text-xs">Key: {p.api_key_masked}</span>
            </button>
            <button onClick={() => { adminApi.deleteProvider(p.id).then(load) }} className="text-text-muted hover:text-danger transition-ui"><Trash2 size={16} /></button>
          </div>
          {expanded[p.id] && (
            <div className="border-t border-border p-4 space-y-2">
              {models.filter((m) => m.provider_id === p.id).map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-bg-surface rounded px-3 py-2 border border-border">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-primary">{m.display_name}</span>
                    <span className="text-xs text-text-muted">{m.model_id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.is_enabled ? 'bg-success-muted text-brand' : 'bg-danger-muted text-danger'}`}>
                      {m.is_enabled ? '启用' : '禁用'}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.supports_vision ? 'bg-brand-muted text-brand' : 'bg-bg-hover text-text-muted'}`}>
                      {m.supports_vision ? 'Vision' : '无Vision'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { adminApi.updateModel(m.id, { is_enabled: !m.is_enabled }).then(load) }} className="text-xs text-text-secondary hover:text-text-primary transition-ui">
                      {m.is_enabled ? '禁用' : '启用'}
                    </button>
                    <button onClick={() => { adminApi.updateModel(m.id, { supports_vision: !m.supports_vision }).then(load) }} className="text-xs text-text-secondary hover:text-text-primary transition-ui">
                      {m.supports_vision ? '关闭Vision' : '开启Vision'}
                    </button>
                    <button onClick={() => { adminApi.deleteModel(m.id).then(load) }} className="text-text-muted hover:text-danger transition-ui"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
              {showAddModel === p.id ? (
                <div className="flex gap-2 mt-2">
                  <input value={newModel.model_id} onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })} placeholder="模型ID (如 qwen-plus)" className="flex-1 bg-bg-surface text-text-primary rounded px-2 py-1 text-sm outline-none border border-border inset-input" />
                  <input value={newModel.display_name} onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })} placeholder="显示名称" className="flex-1 bg-bg-surface text-text-primary rounded px-2 py-1 text-sm outline-none border border-border inset-input" />
                  <button onClick={() => handleAddModel(p.id)} className="px-2 py-1 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">添加</button>
                  <button onClick={() => setShowAddModel(null)} className="px-2 py-1 bg-bg-surface hover:bg-bg-hover rounded text-sm text-text-secondary transition-ui">取消</button>
                </div>
              ) : (
                <button onClick={() => setShowAddModel(p.id)} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mt-2 transition-ui">
                  <Plus size={16} /> 添加模型
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
