import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import * as adminApi from '../../api/admin'

interface UserItem { id: number; username: string; is_admin: boolean; created_at: string }

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '' })

  const load = async () => setUsers(await adminApi.listUsers())
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newUser.username || !newUser.password) return
    await adminApi.createUser(newUser)
    setNewUser({ username: '', password: '' })
    setShowAdd(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">用户管理</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">
          <Plus size={14} /> 创建用户
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
          <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="用户名" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="密码" type="password" className="w-full bg-gray-800 text-white rounded px-3 py-2 text-sm outline-none border border-gray-700" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm">创建</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-medium">{u.username}</span>
              {u.is_admin && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900 text-purple-300">管理员</span>}
              <span className="text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            {!u.is_admin && (
              <button onClick={() => { adminApi.deleteUser(u.id).then(load) }} className="text-gray-500 hover:text-red-400"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
