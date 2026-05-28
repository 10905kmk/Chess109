import { Navigate, Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import LobbyPage from './pages/LobbyPage'
import LocalGamePage from './pages/LocalGamePage'
import AiGamePage from './pages/AiGamePage'
import OnlineGamePage from './pages/OnlineGamePage'
import MatchPage from './pages/MatchPage'
import MyPage from './pages/MyPage'
import RankingPage from './pages/RankingPage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

function RequireFullAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (user.isGuest) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><LobbyPage /></RequireAuth>} />
      <Route path="/me" element={<RequireFullAuth><MyPage /></RequireFullAuth>} />
      <Route path="/ranking" element={<RequireFullAuth><RankingPage /></RequireFullAuth>} />
      <Route path="/local" element={<RequireAuth><LocalGamePage /></RequireAuth>} />
      <Route path="/ai" element={<RequireAuth><AiGamePage /></RequireAuth>} />
      <Route path="/match" element={<RequireFullAuth><MatchPage /></RequireFullAuth>} />
      <Route path="/online" element={<RequireAuth><OnlineGamePage /></RequireAuth>} />
      <Route path="/online/:roomId" element={<RequireAuth><OnlineGamePage /></RequireAuth>} />
    </Routes>
  )
}
