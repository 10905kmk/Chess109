import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVariantGame } from '../variants/useVariantGame.js'
import { getVariant } from '../variants/index.js'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import styles from './GamePage.module.css'

export default function VariantLocalPage() {
  const navigate = useNavigate()
  const { variantId } = useParams()
  const variant = getVariant(variantId)

  const { fen, turn, isCheck, isGameOver, winner, history, extraState, makeMove, reset, getLegalMoves } = useVariantGame(variantId)
  const lastMove = history.length > 0 ? history[history.length - 1] : null

  const handleMove = useCallback((move) => makeMove(move), [makeMove])

  if (!variant) {
    return <div style={{ padding: '2rem' }}>알 수 없는 변형: {variantId}</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
        <h2 className={styles.pageTitle}>{variant.label} — 로컬 2인</h2>
        <button className={styles.resetBtn} onClick={reset}>초기화</button>
      </header>

      {variant.BoardOverlay && <variant.BoardOverlay extraState={extraState} />}
      {variant.StatusExtra && <variant.StatusExtra extraState={extraState} />}

      {isGameOver && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-card)', marginBottom: '0.5rem', borderRadius: '8px' }}>
          {winner === 'draw' ? '무승부!' : `${winner === 'w' ? '백' : '흑'} 승리!`}
          <button onClick={reset} style={{ marginLeft: '1rem' }}>다시 하기</button>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isGameOver ? '' : `${turn === 'w' ? '백' : '흑'}의 차례`}
            {isCheck && !isGameOver ? ' ⚠ 체크' : ''}
          </div>
          <ChessBoardWrapper
            fen={fen}
            onMove={handleMove}
            getLegalMoves={getLegalMoves}
            disabled={isGameOver}
            lastMove={lastMove}
          />
        </div>
        <aside className={styles.sidebar}>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
