import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './LobbyPage.module.css'

const MODES = [
  {
    id: 'match',
    label: '매칭',
    icon: '⚔',
    description: '실력이 비슷한 상대와 자동 매칭',
    color: '#f85149',
    requiresAuth: true,
  },
  {
    id: 'online',
    label: '친선전',
    icon: '🤝',
    description: '방 코드로 친구와 대전',
    color: '#d29922',
  },
  {
    id: 'ai',
    label: 'AI 대전',
    icon: '🤖',
    description: 'Stockfish 엔진과 대결',
    color: '#58a6ff',
  },
  {
    id: 'local',
    label: '로컬 2인',
    icon: '♟',
    description: '같은 화면에서 두 명이 번갈아 두기',
    color: '#3fb950',
  },
]

export default function LobbyPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Chess109</h1>
        <p className={styles.subtitle}>모드를 선택하세요</p>
        {user && (
          <div className={styles.userBadge}>
            <span className={styles.userName}>
              {user.isGuest ? '게스트' : `${user.grade}학년 ${user.klass}반 ${user.name}`}
            </span>
            {!user.isGuest && (
              <>
                <button className={styles.navBtn} onClick={() => navigate('/me')}>
                  내 전적
                </button>
                <button className={styles.navBtn} onClick={() => navigate('/ranking')}>
                  랭킹
                </button>
              </>
            )}
            <button className={styles.logoutBtn} onClick={handleLogout}>
              {user.isGuest ? '로그인' : '로그아웃'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.grid}>
        {MODES.map((mode) => {
          const disabled = mode.requiresAuth && user?.isGuest
          return (
            <button
              key={mode.id}
              className={`${styles.card} ${disabled ? styles.cardDisabled : ''}`}
              style={{ '--card-color': mode.color }}
              onClick={() => !disabled && navigate(`/${mode.id}`)}
              disabled={disabled}
            >
              <span className={styles.icon}>{mode.icon}</span>
              <div className={styles.cardContent}>
                <h2 className={styles.cardTitle}>{mode.label}</h2>
                <p className={styles.cardDesc}>
                  {disabled ? '로그인이 필요합니다' : mode.description}
                </p>
              </div>
              <span className={styles.arrow}>→</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
