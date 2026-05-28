import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = 초기화 전
  const [loading, setLoading] = useState(true)
  const tokenRef              = useRef(null)         // Socket.io용 인메모리 토큰

  // 앱 시작 시 쿠키로 유저 정보 복원 (서버가 쿠키 검증 후 token 반환)
  useEffect(() => {
    fetch(`${SERVER_URL}/auth/me`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user: u, token }) => {
        tokenRef.current = token
        setUser(u)
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (loginId, password) => {
    const resp = await fetch(`${SERVER_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginId, password }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data.error || '로그인 실패')
    tokenRef.current = data.token
    setUser(data.user)
    return data.user
  }, [])

  const loginAsGuest = useCallback(() => {
    tokenRef.current = null
    setUser({ name: '게스트', isGuest: true })
  }, [])

  const logout = useCallback(async () => {
    await fetch(`${SERVER_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    tokenRef.current = null
    setUser(null)
  }, [])

  const getToken = useCallback(() => tokenRef.current, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsGuest, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
