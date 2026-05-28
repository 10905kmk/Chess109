import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './RankingPage.module.css'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''

const MEDALS = ['🥇', '🥈', '🥉']

export default function RankingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    fetch(`${SERVER_URL}/api/ranking`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setRanking(data.ranking))
      .catch(() => setError('랭킹을 불러오지 못했습니다'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.pageTitle}>랭킹</h2>
        <div />
      </header>

      <div className={styles.content}>
        <p className={styles.desc}>온라인 1vs1 기준 · 승수 순 정렬</p>

        {loading && <p className={styles.status}>불러오는 중...</p>}
        {error   && <p className={`${styles.status} ${styles.error}`}>{error}</p>}

        {!loading && !error && ranking.length === 0 && (
          <p className={styles.status}>아직 온라인 게임 기록이 없습니다</p>
        )}

        {ranking.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>순위</th>
                  <th className={styles.nameCol}>이름</th>
                  <th>승</th>
                  <th>패</th>
                  <th>무</th>
                  <th>승률</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, i) => {
                  const rank    = i + 1
                  const winRate = row.total > 0
                    ? Math.round((row.wins / row.total) * 100)
                    : 0
                  const isMe = user?.email === row.email

                  return (
                    <tr key={row.email} className={isMe ? styles.myRow : ''}>
                      <td className={styles.rankCell}>
                        {rank <= 3 ? MEDALS[rank - 1] : rank}
                      </td>
                      <td className={styles.nameCell}>
                        <span className={styles.playerName}>{row.name}</span>
                        <span className={styles.playerSub}>
                          {row.grade}학년 {row.klass}반
                        </span>
                      </td>
                      <td className={styles.win}>{row.wins}</td>
                      <td className={styles.loss}>{row.losses}</td>
                      <td className={styles.draw}>{row.draws}</td>
                      <td className={styles.rate}>{winRate}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
