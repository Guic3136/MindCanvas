import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as adminApi from '../../api/admin'

interface UserItem { id: number; username: string; is_admin: boolean; created_at: string }

export default function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '' })

  const load = async () => { const resp = await adminApi.listUsers(); setUsers(resp.items) }
  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!newUser.username || !newUser.password) {
      toast.error('请填写所有必填字段')
      return
    }
    await adminApi.createUser(newUser)
    setNewUser({ username: '', password: '' })
    setShowAdd(false)
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">用户管理</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">
          <Plus size={16} /> 创建用户
        </button>
      </div>

      {showAdd && (
        <div className="bg-bg-raised border border-border rounded-lg p-4 space-y-3 shadow-raised">
          <input value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} placeholder="用户名" className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input" />
          <input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="密码" type="password" className="w-full bg-bg-surface text-text-primary rounded px-3 py-2 text-sm outline-none border border-border inset-input" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-text-inverse rounded text-sm transition-ui">创建</button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-bg-surface hover:bg-bg-hover rounded text-sm text-text-secondary transition-ui">取消</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between bg-bg-raised border border-border rounded-lg px-4 py-3 shadow-raised">
            <div className="flex items-center gap-3">
              <span className="font-medium text-text-primary">{u.username}</span>
              {u.is_admin && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-muted text-accent">管理员</span>}
              <span className="text-xs text-text-muted">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
            {!u.is_admin && (
              <button onClick={() => { adminApi.deleteUser(u.id).then(load) }} className="text-text-muted hover:text-danger transition-ui"><Trash2 size={16} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
