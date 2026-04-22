import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Settings, X } from 'lucide-react'
import { toast } from 'sonner'
import * as projectApi from '../../api/project'
import { useAuthStore } from '../../stores/authStore'
import { useModal } from '../../hooks/useModal'
import type { ProjectListItem } from '../../types'

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const createModal = useModal(showCreateModal)
  const deleteModal = useModal(deleteTarget !== null)

  const load = async () => {
    setLoading(true)
    const resp = await projectApi.listProjects()
    setProjects(resp.items)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!newProjectName.trim()) return
    const project = await projectApi.createProject(newProjectName.trim())
    setNewProjectName('')
    setShowCreateModal(false)
    toast.success(`项目「${project.name}」已创建`)
    navigate(`/canvas/${project.id}`)
  }

  const handleDelete = async (id: number) => {
    await projectApi.deleteProject(id)
    setDeleteTarget(null)
    toast.success('项目已删除')
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-screen bg-bg"><div className="spinner-refined" role="status" aria-label="正在加载项目列表" /></div>

  return (
    <div className="min-h-screen bg-bg text-text-primary p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-semibold">MindCanvas</h1>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">
              <Plus size={18} /> 新建项目
            </button>
          </div>
          <div className="flex items-center gap-3">
            {user?.is_admin && (
              <a href="/admin" className="p-2.5 text-text-muted hover:text-text-primary rounded" title="管理面板" aria-label="管理面板">
                <Settings size={18} />
              </a>
            )}
            <span className="text-text-muted text-sm hidden sm:inline">{user?.username}</span>
            <button onClick={logout} className="text-sm text-text-muted hover:text-text-primary">
              退出
            </button>
          </div>
        </div>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-center">
            <div className="w-16 h-16 rounded-full bg-bg-surface flex items-center justify-center mb-4 glow-accent">
              <Plus size={32} className="text-text-muted" />
            </div>
            <h2 className="text-lg font-medium text-text-secondary mb-2">创建你的第一个项目</h2>
            <p className="text-text-muted text-sm max-w-xs mb-6">项目是你探索 AI 提示词的工作空间，每个项目包含独立的画布和调试会话。</p>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-hover text-text-inverse text-sm rounded-lg font-medium transition-ui">
              <Plus size={18} /> 创建项目
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/canvas/${p.id}`)}
                className="flex items-center justify-between p-4 bg-bg-raised rounded-lg hover:bg-bg-hover cursor-pointer transition-colors border border-border card-hover"
              >
                <div>
                  <h2 className="text-lg font-medium text-text-primary">{p.name}</h2>
                  <p className="text-sm text-text-muted">{new Date(p.updated_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.id) }}
                  className="p-2.5 text-text-muted hover:text-danger"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="创建新项目" ref={createModal.containerRef}>
          <div className="bg-bg-raised border border-border-strong rounded-lg p-6 w-96 space-y-4 shadow-popover">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-text-primary">新建项目</h3>
              <button onClick={() => { setShowCreateModal(false); setNewProjectName('') }} className="text-text-secondary hover:text-text-primary transition-ui"><X size={18} /></button>
            </div>
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="项目名称"
              className="w-full bg-bg-input text-text-primary rounded-md px-3 py-2 text-sm outline-none border border-border"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowCreateModal(false); setNewProjectName('') }} className="px-4 py-1.5 bg-bg-surface hover:bg-bg-hover rounded text-sm text-text-secondary transition-ui">取消</button>
              <button onClick={handleCreate} className="px-4 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">创建</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="确认删除" ref={deleteModal.containerRef}>
          <div className="bg-bg-raised border border-border-strong rounded-lg p-6 w-80 space-y-4 shadow-popover">
            <h3 className="text-lg font-medium text-text-primary">确认删除</h3>
            <p className="text-sm text-text-secondary">确定删除此项目？此操作不可撤销。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-1.5 bg-bg-surface hover:bg-bg-hover rounded text-sm text-text-secondary transition-ui">取消</button>
              <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-1.5 bg-danger hover:bg-danger-hover text-text-inverse rounded text-sm transition-ui">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
