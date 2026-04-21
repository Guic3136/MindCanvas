import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
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
    setProviders(p)
    setModels(m)
  }

  useEffect(() => { load() }, [])

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.base_url || !newProvider.api_key) return
    await adminApi.createProvider(newProvider)
    setNewProvider({ name: '', base_url: '', api_key: '' })
    setShowAddProvider(false)
    load()
  }

  const handleAddModel = async (providerId: number) => {
    if (!newModel.model_id || !newModel.display_name) return
    await adminApi.createModel({ provider_id: providerId, ...newModel })
    setNewModel({ model_id: '', display_name: '' })
    setShowAddModel(null)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">模型配置</h2>
        <button onClick={() => setShowAddProvider(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
          <Plus size={14} /> 添加 Provider
        </button>
      </div>

      {showAddProvider && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <input value={newProvider.name} onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })} placeholder="名称（如：通义千问）" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <input value={newProvider.base_url} onChange={(e) => setNewProvider({ ...newProvider, base_url: e.target.value })} placeholder="API 地址" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <input value={newProvider.api_key} onChange={(e) => setNewProvider({ ...newProvider, api_key: e.target.value })} placeholder="API Key" type="password" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <div className="flex gap-2">
            <button onClick={handleAddProvider} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">保存</button>
            <button onClick={() => setShowAddProvider(false)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">取消</button>
          </div>
        </div>
      )}

      {providers.map((p) => (
        <div key={p.id} className="bg-gray-900 border border-gray-700 rounded-lg">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setExpanded({ ...expanded, [p.id]: !expanded[p.id] })} className="flex items-center gap-2 text-left">
              {expanded[p.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <span className="font-medium">{p.name}</span>
              <span className="text-gray-500 text-sm">{p.base_url}</span>
              <span className="text-gray-600 text-xs">Key: {p.api_key_masked}</span>
            </button>
            <button onClick={() => { adminApi.deleteProvider(p.id).then(load) }} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
          </div>
          {expanded[p.id] && (
            <div className="border-t border-gray-700 p-4 space-y-2">
              {models.filter((m) => m.provider_id === p.id).map((m) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{m.display_name}</span>
                    <span className="text-xs text-gray-500">{m.model_id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.is_enabled ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                      {m.is_enabled ? '启用' : '禁用'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { adminApi.updateModel(m.id, { is_enabled: !m.is_enabled }).then(load) }} className="text-xs text-gray-400 hover:text-white">
                      {m.is_enabled ? '禁用' : '启用'}
                    </button>
                    <button onClick={() => { adminApi.deleteModel(m.id).then(load) }} className="text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {showAddModel === p.id ? (
                <div className="flex gap-2 mt-2">
                  <input value={newModel.model_id} onChange={(e) => setNewModel({ ...newModel, model_id: e.target.value })} placeholder="模型ID (如 qwen-plus)" className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm outline-none" />
                  <input value={newModel.display_name} onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })} placeholder="显示名称" className="flex-1 bg-gray-700 text-white rounded px-2 py-1 text-sm outline-none" />
                  <button onClick={() => handleAddModel(p.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm">添加</button>
                  <button onClick={() => setShowAddModel(null)} className="px-2 py-1 bg-gray-700 rounded text-sm">取消</button>
                </div>
              ) : (
                <button onClick={() => setShowAddModel(p.id)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mt-2">
                  <Plus size={14} /> 添加模型
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
