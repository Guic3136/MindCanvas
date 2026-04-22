import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import { getMe } from './api/auth'
import LoginPage from './components/Auth/LoginPage'
import ProjectList from './components/ProjectList/ProjectList'
import FlowCanvas from './components/Canvas/FlowCanvas'
import AdminLayout from './components/AdminPanel/AdminLayout'
import PageTransition from './components/Layout/PageTransition'

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
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="spinner-refined" role="status" aria-label="正在加载应用" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : <PageTransition><LoginPage /></PageTransition>}
      />
      <Route
        path="/"
        element={user ? <PageTransition><ProjectList /></PageTransition> : <Navigate to="/login" />}
      />
      <Route
        path="/canvas/:id"
        element={user ? <PageTransition><FlowCanvas /></PageTransition> : <Navigate to="/login" />}
      />
      <Route
        path="/admin"
        element={user?.is_admin ? <PageTransition><AdminLayout /></PageTransition> : <Navigate to="/" />}
      />
    </Routes>
  )
}

export default App
