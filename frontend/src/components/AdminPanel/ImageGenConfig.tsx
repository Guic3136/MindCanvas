import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as adminApi from '../../api/admin'
import type { ImageGenConfig } from '../../api/admin'

export default function ImageGenConfig() {
  const [config, setConfig] = useState<ImageGenConfig | null>(null)
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [modelId, setModelId] = useState('')
  const [apiKey, setApiKey] = useState('')

  useEffect(() => {
    adminApi.getImageGenConfig().then((c) => {
      setConfig(c)
      setName(c.name)
      setBaseUrl(c.base_url)
      setModelId(c.model_id)
    })
  }, [])

  const handleSave = async () => {
    const payload: { name?: string; base_url?: string; model_id?: string; api_key?: string } = {}
    if (name !== config?.name) payload.name = name
    if (baseUrl !== config?.base_url) payload.base_url = baseUrl
    if (modelId !== config?.model_id) payload.model_id = modelId
    if (apiKey) payload.api_key = apiKey

    try {
      const updated = await adminApi.updateImageGenConfig(payload)
      setConfig(updated)
      setApiKey('')
      toast.success('保存成功')
    } catch {
      toast.error('保存失败')
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-text-primary">图片生成配置</h2>
      <div className="bg-bg-raised border border-border rounded-lg p-4 space-y-4 shadow-raised max-w-xl">
        <div>
          <label className="block text-text-secondary text-xs mb-1">配置名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：qwen-image-2.0-pro"
            className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1">API 地址</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="如：https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
            className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1">模型 ID</label>
          <input
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="如：qwen-image-2.0-pro"
            className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input"
          />
        </div>
        <div>
          <label className="block text-text-secondary text-xs mb-1">API Key</label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.api_key_masked ? '已设置，重新输入可覆盖' : '请输入 DashScope API Key'}
            type="password"
            className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
