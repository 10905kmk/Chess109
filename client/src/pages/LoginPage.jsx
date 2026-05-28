import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { login, loginAsGuest } = useAuth()
  const navigate = useNavigate()

  const [loginId, setLoginId]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(loginId, password)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>♟</div>
        <h1 className={styles.title}>Chess 109</h1>
        <p className={styles.subtitle}>슈퍼스쿨 계정으로 로그인하세요</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            아이디 (이메일)
            <input
              className={styles.input}
              type="text"
              placeholder="예: example@dshs.kr"
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className={styles.label}>
            비밀번호
            <input
              className={styles.input}
              type="password"
              placeholder="슈퍼스쿨 비밀번호"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className={styles.divider}>또는</div>

        <button
          className={styles.guestBtn}
          type="button"
          onClick={() => { loginAsGuest(); navigate('/') }}
        >
          게스트로 입장
        </button>

        <p className={styles.notice}>
          비밀번호는 전송 후 즉시 폐기되며 저장되지 않습니다.
        </p>
      </div>
    </div>
  )
}
