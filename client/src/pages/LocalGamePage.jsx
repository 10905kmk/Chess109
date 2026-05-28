import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChessGame } from '../hooks/useChessGame'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import GameStatus from '../components/GameStatus'
import styles from './GamePage.module.css'

export default function LocalGamePage() {
  const navigate = useNavigate()
  const {
    game, fen, turn, isCheck, isCheckmate, isDraw, isGameOver,
    history, makeMove, reset, getLegalMoves,
  } = useChessGame()

  const lastMove = history.length > 0 ? history[history.length - 1] : null

  const handleMove = useCallback((move) => {
    return makeMove(move)
  }, [makeMove])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.pageTitle}>로컬 2인 대전</h2>
        <button className={styles.resetBtn} onClick={reset}>초기화</button>
      </header>

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <GameStatus
            turn={turn}
            isCheck={isCheck}
            isCheckmate={isCheckmate}
            isDraw={isDraw}
            isGameOver={isGameOver}
            onReset={reset}
          />
          <ChessBoardWrapper
            fen={fen}
            onMove={handleMove}
            getLegalMoves={getLegalMoves}
            disabled={isGameOver}
            lastMove={lastMove}
            isCheck={isCheck}
          />
        </div>

        <aside className={styles.sidebar}>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
