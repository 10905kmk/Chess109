import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChessGame } from '../hooks/useChessGame'
import { useAuth } from '../hooks/useAuth'
import { socket } from '../lib/socket'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import GameStatus from '../components/GameStatus'
import gameStyles from './GamePage.module.css'
import styles from './MatchPage.module.css'

export default function MatchPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [phase, setPhase] = useState('idle') // idle | queuing | playing
  const [roomId, setRoomId] = useState(null)
  const [playerColor, setPlayerColor] = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(false)

  const {
    fen, turn, isCheck, isCheckmate, isDraw, isGameOver,
    history, makeMove, reset, getLegalMoves,
  } = useChessGame()

  const isMyTurn = playerColor && turn === playerColor && opponentConnected
  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn
  const isGameOverRef = useRef(isGameOver)
  isGameOverRef.current = isGameOver
  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId

  useEffect(() => {
    socket.connect()

    socket.on('match:found', ({ roomId: id, color }) => {
      setRoomId(id)
      setPlayerColor(color)
      setOpponentConnected(true)
      setPhase('playing')
    })

    socket.on('room:opponentLeft', () => setOpponentConnected(false))

    socket.on('game:move', ({ from, to, promotion }) => {
      makeMove({ from, to, promotion })
    })

    return () => {
      socket.off('match:found')
      socket.off('room:opponentLeft')
      socket.off('game:move')
      socket.disconnect()
    }
  }, [])

  const handleStart = () => {
    socket.emit('match:enqueue', { token: getToken() })
    setPhase('queuing')
  }

  const handleCancel = () => {
    socket.emit('match:cancel')
    setPhase('idle')
  }

  const handleMove = useCallback((move) => {
    if (!isMyTurnRef.current || isGameOverRef.current) return null
    const result = makeMove(move)
    if (result) {
      socket.emit('game:move', {
        roomId: roomIdRef.current,
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q',
      })
    }
    return result
  }, [makeMove])

  const handleLeave = () => {
    reset()
    navigate('/')
  }

  const lastMove = history.length > 0 ? history[history.length - 1] : null

  if (phase === 'idle') {
    return (
      <div className={styles.page}>
        <header className={gameStyles.header}>
          <button className={gameStyles.backBtn} onClick={() => navigate('/')}>← 로비</button>
          <h2 className={gameStyles.pageTitle}>매칭</h2>
          <div />
        </header>
        <div className={styles.center}>
          <div className={styles.card}>
            <span className={styles.bigIcon}>⚔</span>
            <h2 className={styles.cardTitle}>자동 매칭</h2>
            <p className={styles.cardDesc}>
              접속 중인 플레이어와 자동으로 매칭됩니다.<br />
              결과는 랭킹에 반영됩니다.
            </p>
            <button className={styles.startBtn} onClick={handleStart}>
              매칭 시작
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'queuing') {
    return (
      <div className={styles.page}>
        <header className={gameStyles.header}>
          <button className={gameStyles.backBtn} onClick={() => navigate('/')}>← 로비</button>
          <h2 className={gameStyles.pageTitle}>매칭 중...</h2>
          <div />
        </header>
        <div className={styles.center}>
          <div className={styles.card}>
            <div className={styles.spinner} />
            <h2 className={styles.cardTitle}>상대 탐색 중</h2>
            <p className={styles.cardDesc}>접속 중인 플레이어를 찾고 있습니다...</p>
            <button className={styles.cancelBtn} onClick={handleCancel}>
              취소
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={gameStyles.page}>
      <header className={gameStyles.header}>
        <button className={gameStyles.backBtn} onClick={handleLeave}>← 나가기</button>
        <h2 className={gameStyles.pageTitle}>
          매칭
          {!opponentConnected && <span className={styles.disconnected}> (상대방 연결 끊김)</span>}
        </h2>
        <button className={gameStyles.resetBtn} onClick={handleLeave}>나가기</button>
      </header>

      <div className={gameStyles.layout}>
        <div className={gameStyles.boardSection}>
          <GameStatus
            turn={turn}
            isCheck={isCheck}
            isCheckmate={isCheckmate}
            isDraw={isDraw}
            isGameOver={isGameOver}
            onReset={handleLeave}
          />
          <ChessBoardWrapper
            fen={fen}
            orientation={playerColor === 'w' ? 'white' : 'black'}
            onMove={handleMove}
            getLegalMoves={isMyTurn ? getLegalMoves : undefined}
            disabled={!isMyTurn || isGameOver}
            lastMove={lastMove}
            isCheck={isCheck}
          />
        </div>

        <aside className={gameStyles.sidebar}>
          <div className={styles.matchInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>내 색상</span>
              <span>{playerColor === 'w' ? '♔ 백' : '♚ 흑'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>상대방</span>
              <span className={opponentConnected ? styles.online : styles.offline}>
                {opponentConnected ? '● 연결됨' : '○ 대기 중'}
              </span>
            </div>
          </div>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
