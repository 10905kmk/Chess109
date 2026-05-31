import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChessGame } from '../hooks/useChessGame'
import { useAuth } from '../hooks/useAuth'
import { socket } from '../lib/socket'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import GameStatus from '../components/GameStatus'
import styles from './GamePage.module.css'
import onlineStyles from './OnlineGamePage.module.css'

export default function OnlineGamePage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { roomId: paramRoomId } = useParams()

  const [phase, setPhase] = useState(paramRoomId ? 'joining' : 'lobby')
  const [roomId, setRoomId] = useState(paramRoomId || '')
  const [inputRoomId, setInputRoomId] = useState('')
  const [playerColor, setPlayerColor] = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [error, setError] = useState('')
  const [colorPref, setColorPref] = useState('random')

  const {
    fen, turn, isCheck, isCheckmate, isDraw, isGameOver,
    history, makeMove, loadFen, reset, getLegalMoves,
  } = useChessGame()

  const lastMove = history.length > 0 ? history[history.length - 1] : null
  const isMyTurn = playerColor && turn === playerColor && opponentConnected

  useEffect(() => {
    socket.connect()

    socket.on('room:created', ({ roomId: id, color }) => {
      setRoomId(id)
      setPlayerColor(color)
      setPhase('waiting')
    })

    socket.on('room:joined', ({ color, fen: initialFen, roomId: joinedRoomId }) => {
      if (joinedRoomId) setRoomId(joinedRoomId)
      setPlayerColor(color)
      if (initialFen) loadFen(initialFen)
      setOpponentConnected(true)
      setPhase('playing')
    })

    socket.on('room:opponentJoined', () => {
      setOpponentConnected(true)
      setPhase('playing')
    })

    socket.on('room:opponentLeft', () => {
      setOpponentConnected(false)
    })

    socket.on('game:move', ({ from, to, promotion }) => {
      makeMove({ from, to, promotion })
    })

    socket.on('game:reset', ({ fen: newFen }) => {
      loadFen(newFen)
    })

    socket.on('room:error', ({ message }) => {
      setError(message)
    })

    if (paramRoomId) {
      socket.emit('room:join', { roomId: paramRoomId, token: getToken() })
    }

    const handleReconnect = () => {
      const currentPhase = phaseRef.current
      const currentRoomId = roomIdRef.current
      if ((currentPhase === 'playing' || currentPhase === 'waiting') && currentRoomId) {
        socket.emit('room:join', { roomId: currentRoomId, token: getToken() })
      }
    }
    socket.io.on('reconnect', handleReconnect)

    return () => {
      socket.off('room:created')
      socket.off('room:joined')
      socket.off('room:opponentJoined')
      socket.off('room:opponentLeft')
      socket.off('game:move')
      socket.off('game:reset')
      socket.off('room:error')
      socket.io.off('reconnect', handleReconnect)
      socket.disconnect()
    }
  }, [])

  const handleCreateRoom = () => {
    setError('')
    socket.emit('room:create', { token: getToken(), preferredColor: colorPref })
  }

  const handleJoinRoom = () => {
    const id = inputRoomId.trim().toUpperCase()
    if (!id) return
    setError('')
    setRoomId(id)
    socket.emit('room:join', { roomId: id, token: getToken() })
  }

  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn
  const isGameOverRef = useRef(isGameOver)
  isGameOverRef.current = isGameOver
  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId
  const phaseRef = useRef(phase)
  phaseRef.current = phase

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

  const handleReset = () => {
    reset()
    socket.emit('game:reset', { roomId })
    navigate('/')
  }

  const shareUrl = `${window.location.origin}/online/${roomId}`

  if (phase === 'lobby') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
          <h2 className={styles.pageTitle}>온라인 대전</h2>
          <div />
        </header>

        <div className={onlineStyles.lobby}>
          {error && <p className={onlineStyles.error}>{error}</p>}

          <div className={onlineStyles.lobbySection}>
            <h3 className={onlineStyles.sectionTitle}>새 게임 만들기</h3>
            <p className={onlineStyles.sectionDesc}>방을 만들고 친구에게 코드를 공유하세요</p>
            <div className={onlineStyles.colorPicker}>
              {[
                { value: 'w', label: '♔ 백' },
                { value: 'random', label: '🎲 랜덤' },
                { value: 'b', label: '♚ 흑' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  className={`${onlineStyles.colorBtn} ${colorPref === value ? onlineStyles.colorBtnActive : ''}`}
                  onClick={() => setColorPref(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className={onlineStyles.primaryBtn} onClick={handleCreateRoom}>
              방 만들기
            </button>
          </div>

          <div className={onlineStyles.divider}>또는</div>

          <div className={onlineStyles.lobbySection}>
            <h3 className={onlineStyles.sectionTitle}>방 참가하기</h3>
            <div className={onlineStyles.joinRow}>
              <input
                className={onlineStyles.input}
                placeholder="방 코드 입력 (예: AB12)"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                maxLength={6}
              />
              <button className={onlineStyles.secondaryBtn} onClick={handleJoinRoom}>
                참가
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← 나가기</button>
          <h2 className={styles.pageTitle}>상대를 기다리는 중...</h2>
          <div />
        </header>

        <div className={onlineStyles.waiting}>
          <div className={onlineStyles.roomCode}>
            <span className={onlineStyles.roomCodeLabel}>방 코드</span>
            <span className={onlineStyles.roomCodeValue}>{roomId}</span>
          </div>
          <p className={onlineStyles.waitingDesc}>친구에게 이 링크를 공유하세요</p>
          <div className={onlineStyles.shareRow}>
            <span className={onlineStyles.shareUrl}>{shareUrl}</span>
            <button
              className={onlineStyles.copyBtn}
              onClick={() => navigator.clipboard.writeText(shareUrl)}
            >
              복사
            </button>
          </div>
          <div className={onlineStyles.spinner} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 나가기</button>
        <h2 className={styles.pageTitle}>
          온라인 대전
          {!opponentConnected && <span className={onlineStyles.disconnected}> (상대방 연결 끊김)</span>}
        </h2>
        <button className={styles.resetBtn} onClick={handleReset}>나가기</button>
      </header>

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <GameStatus
            turn={turn}
            isCheck={isCheck}
            isCheckmate={isCheckmate}
            isDraw={isDraw}
            isGameOver={isGameOver}
            onReset={handleReset}
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

        <aside className={styles.sidebar}>
          <div className={onlineStyles.roomInfo}>
            <div className={onlineStyles.infoRow}>
              <span className={onlineStyles.infoLabel}>방 코드</span>
              <span className={onlineStyles.roomCodeSmall}>{roomId}</span>
            </div>
            <div className={onlineStyles.infoRow}>
              <span className={onlineStyles.infoLabel}>내 색상</span>
              <span>{playerColor === 'w' ? '♔ 백' : '♚ 흑'}</span>
            </div>
            <div className={onlineStyles.infoRow}>
              <span className={onlineStyles.infoLabel}>상대방</span>
              <span className={opponentConnected ? onlineStyles.online : onlineStyles.offline}>
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
