import { useState } from 'react'
import { Server, Users, ArrowLeft } from 'lucide-react'
import ModelProviders from './ModelProviders'
import UserManagement from './UserManagement'

type Tab = 'providers' | 'users'

export default function AdminLayout() {
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <div className="border-b border-border px-6 py-3 flex items-center gap-4">
        <a href="/" className="text-text-secondary hover:text-text-primary transition-ui"><ArrowLeft size={20} /></a>
        <h1 className="text-xl font-semibold text-text-primary">管理员设置</h1>
      </div>
      <div className="flex flex-col sm:flex-row">
        <nav className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-border p-2 sm:p-4 space-y-1 flex sm:flex-col sm:space-y-1 sm:space-x-0 gap-2 overflow-x-auto">
          <button
            onClick={() => setTab('providers')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-ui ${tab === 'providers' ? 'bg-bg-surface text-text-primary border border-border inset-highlight' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <Server size={16} /> 模型配置
          </button>
          <button
            onClick={() => setTab('users')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-ui ${tab === 'users' ? 'bg-bg-surface text-text-primary border border-border inset-highlight' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <Users size={16} /> 用户管理
          </button>
        </nav>
        <main className="flex-1 p-6">
          {tab === 'providers' && <ModelProviders />}
          {tab === 'users' && <UserManagement />}
        </main>
      </div>
    </div>
  )
}
