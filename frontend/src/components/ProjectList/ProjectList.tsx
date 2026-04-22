import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Settings, X } from 'lucide-react'
import * as projectApi from '../../api/project'
import { useAuthStore } from '../../stores/authStore'
import type { ProjectListItem } from '../../types'

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

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
    navigate(`/canvas/${project.id}`)
  }

  const handleDelete = async (id: number) => {
    await projectApi.deleteProject(id)
    setDeleteTarget(null)
    load()
  }

  if (loading) return <div className="text-gray-400 p-8">加载中...</div>

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold">MindCanvas</h1>
            {user?.is_admin && (
              <a href="/admin" className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
                <Settings size={16} /> 管理
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">{user?.username}</span>
            <button onClick={logout} className="text-sm text-gray-400 hover:text-white">
              退出
            </button>
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">
              <Plus size={18} /> 新建项目
            </button>
          </div>
        </div>
        {projects.length === 0 ? (
          <p className="text-gray-500 text-center mt-20">还没有项目，点击上方创建一个</p>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/canvas/${p.id}`)}
                className="flex items-center justify-between p-4 bg-gray-900 rounded-lg hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <div>
                  <h2 className="text-lg font-medium">{p.name}</h2>
                  <p className="text-sm text-gray-500">{new Date(p.updated_at).toLocaleString()}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(p.id) }}
                  className="p-2 text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">新建项目</h3>
              <button onClick={() => { setShowCreateModal(false); setNewProjectName('') }} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="项目名称"
              className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowCreateModal(false); setNewProjectName('') }} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">取消</button>
              <button onClick={handleCreate} className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">创建</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-80 space-y-4">
            <h3 className="text-lg font-medium">确认删除</h3>
            <p className="text-sm text-gray-400">确定删除此项目？此操作不可撤销。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">取消</button>
              <button onClick={() => handleDelete(deleteTarget)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm">删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
