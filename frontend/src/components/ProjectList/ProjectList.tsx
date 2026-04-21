import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Settings } from 'lucide-react'
import * as projectApi from '../../api/project'
import { useAuthStore } from '../../stores/authStore'
import type { ProjectListItem } from '../../types'

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const load = async () => {
    setLoading(true)
    const list = await projectApi.listProjects()
    setProjects(list)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    const name = prompt('项目名称：')
    if (!name) return
    const project = await projectApi.createProject(name)
    navigate(`/canvas/${project.id}`)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此项目？')) return
    await projectApi.deleteProject(id)
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
            <button onClick={handleCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded">
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
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id) }}
                  className="p-2 text-gray-500 hover:text-red-400"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
