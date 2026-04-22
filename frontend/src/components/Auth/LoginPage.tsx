import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { login, getMe } from '../../api/auth'
import { useAuthStore } from '../../stores/authStore'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      const user = await getMe()
      setUser(user)
      toast.success('登录成功')
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-md p-8 bg-bg-raised rounded-lg shadow-raised border border-border inset-highlight">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">MindCanvas</h1>
          <p className="text-text-muted text-sm mt-1">可视化 AI 提示词调试工具</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-bg-input text-text-primary border border-border rounded-md"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-bg-input text-text-primary border border-border rounded-md"
              required
            />
          </div>
          {error && (
            <div className="bg-danger-muted border border-danger/20 text-danger text-sm rounded-md px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-brand text-text-inverse rounded-md hover:bg-brand-hover disabled:opacity-50 flex items-center justify-center gap-2 transition-ui"
          >
            {loading && <div className="spinner-refined border-white/20 border-t-brand" />}
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
