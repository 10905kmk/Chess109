import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './MyPage.module.css'

function StatCard({ title, stats }) {
  const winRate = stats.total > 0
    ? Math.round((stats.wins / stats.total) * 100)
    : 0

  return (
    <div className={styles.statCard}>
      <h3 className={styles.statTitle}>{title}</h3>
      {stats.total === 0 ? (
        <p className={styles.noGames}>아직 게임 기록이 없습니다</p>
      ) : (
        <>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statNum + ' ' + styles.win}>{stats.wins}</span>
              <span className={styles.statLabel}>승</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum + ' ' + styles.loss}>{stats.losses}</span>
              <span className={styles.statLabel}>패</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNum + ' ' + styles.draw}>{stats.draws}</span>
              <span className={styles.statLabel}>무</span>
            </div>
          </div>
          <div className={styles.winBar}>
            <div className={styles.winFill} style={{ width: `${winRate}%` }} />
          </div>
          <p className={styles.winRate}>승률 {winRate}% · 총 {stats.total}게임</p>
        </>
      )}
    </div>
  )
}

function resultLabel(r) {
  if (r === 'win')  return { text: '승', cls: styles.win }
  if (r === 'loss') return { text: '패', cls: styles.loss }
  return { text: '무', cls: styles.draw }
}

function modeLabel(m) {
  return m === 'online' ? '온라인' : 'AI 대전'
}

export default function MyPage() {
  const navigate  = useNavigate()
  const { user, getToken } = useAuth()

  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch('/api/me/stats', {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setStats)
      .catch(() => setError('통계를 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.pageTitle}>내 페이지</h2>
        <div />
      </header>

      <div className={styles.content}>
        {user && (
          <div className={styles.profileCard}>
            <div className={styles.avatar}>{user.name[0]}</div>
            <div className={styles.profileInfo}>
              <h2 className={styles.profileName}>{user.name}</h2>
              <p className={styles.profileSub}>{user.grade}학년 {user.klass}반 · {user.school}</p>
              <p className={styles.profileEmail}>{user.email}</p>
            </div>
          </div>
        )}

        {loading && <p className={styles.loading}>불러오는 중...</p>}
        {error   && <p className={styles.error}>{error}</p>}

        {stats && (
          <>
            <div className={styles.statsGrid}>
              <StatCard title="온라인 대전" stats={stats.online} />
              <StatCard title="AI 대전"    stats={stats.ai} />
            </div>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>최근 게임</h3>
              {stats.recentGames.length === 0 ? (
                <p className={styles.noGames}>아직 게임 기록이 없습니다</p>
              ) : (
                <div className={styles.gameList}>
                  {stats.recentGames.map(g => {
                    const { text, cls } = resultLabel(g.playerResult)
                    return (
                      <div key={g.id} className={styles.gameRow}>
                        <span className={`${styles.resultBadge} ${cls}`}>{text}</span>
                        <div className={styles.gameInfo}>
                          <span className={styles.gameOpponent}>
                            {g.opponentName}
                          </span>
                          <span className={styles.gameMeta}>
                            {modeLabel(g.mode)} · {g.playerColor === 'w' ? '백' : '흑'}
                          </span>
                        </div>
                        <span className={styles.gameDate}>
                          {new Date(g.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
