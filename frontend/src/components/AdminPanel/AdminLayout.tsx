import { useState } from 'react'
import { Server, Users, ArrowLeft } from 'lucide-react'
import ModelProviders from './ModelProviders'
import UserManagement from './UserManagement'

type Tab = 'providers' | 'users'

export default function AdminLayout() {
  const [tab, setTab] = useState<Tab>('providers')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-700 px-6 py-3 flex items-center gap-4">
        <a href="/" className="text-gray-400 hover:text-white"><ArrowLeft size={20} /></a>
        <h1 className="text-xl font-bold">管理员设置</h1>
      </div>
      <div className="flex">
        <nav className="w-48 border-r border-gray-700 p-4 space-y-1">
          <button
            onClick={() => setTab('providers')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${tab === 'providers' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Server size={16} /> 模型配置
          </button>
          <button
            onClick={() => setTab('users')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${tab === 'users' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'}`}
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
