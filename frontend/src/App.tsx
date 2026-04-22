import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { getMe } from './api/auth'
import LoginPage from './components/Auth/LoginPage'
import ProjectList from './components/ProjectList/ProjectList'
import FlowCanvas from './components/Canvas/FlowCanvas'
import AdminLayout from './components/AdminPanel/AdminLayout'

function App() {
  const { user, isLoading, setUser, setLoading, logout } = useAuthStore()

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => logout())
      .finally(() => setLoading(false))
  }, [setUser, setLoading, logout])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-lg text-gray-400">加载中...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : <LoginPage />}
      />
      <Route
        path="/"
        element={user ? <ProjectList /> : <Navigate to="/login" />}
      />
      <Route
        path="/canvas/:id"
        element={user ? <FlowCanvas /> : <Navigate to="/login" />}
      />
      <Route
        path="/admin"
        element={user?.is_admin ? <AdminLayout /> : <Navigate to="/" />}
      />
    </Routes>
  )
}

export default App
