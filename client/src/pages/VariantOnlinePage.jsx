import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVariantGame } from '../variants/useVariantGame.js'
import { getVariant } from '../variants/index.js'
import { useAuth } from '../hooks/useAuth'
import { socket } from '../lib/socket'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import styles from './GamePage.module.css'
import onlineStyles from './OnlineGamePage.module.css'

export default function VariantOnlinePage() {
  const navigate = useNavigate()
  const { variantId, roomId: paramRoomId } = useParams()
  const { getToken } = useAuth()
  const variant = getVariant(variantId)

  const [phase, setPhase] = useState(paramRoomId ? 'joining' : 'lobby')
  const [roomId, setRoomId] = useState(paramRoomId || '')
  const [inputRoomId, setInputRoomId] = useState('')
  const [playerColor, setPlayerColor] = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [error, setError] = useState('')
  const [colorPref, setColorPref] = useState('random')

  const { fen, turn, isGameOver, winner, history, extraState, makeMove, loadFen, reset, getLegalMoves } = useVariantGame(variantId)
  const lastMove = history.length > 0 ? history[history.length - 1] : null
  const isMyTurn = playerColor && turn === playerColor && opponentConnected

  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn
  const isGameOverRef = useRef(isGameOver)
  isGameOverRef.current = isGameOver

  useEffect(() => {
    socket.connect()

    socket.on('variant:created', ({ roomId: id, color, startFen }) => {
      setRoomId(id); setPlayerColor(color); setPhase('waiting')
      if (startFen) loadFen(startFen)
    })
    socket.on('variant:joined', ({ color, roomId: joinedRoomId, startFen }) => {
      if (joinedRoomId) setRoomId(joinedRoomId)
      setPlayerColor(color); setOpponentConnected(true); setPhase('playing')
      if (startFen) loadFen(startFen)
    })
    socket.on('variant:opponentJoined', () => { setOpponentConnected(true); setPhase('playing') })
    socket.on('variant:opponentLeft', () => setOpponentConnected(false))
    socket.on('variant:move', ({ from, to, promotion }) => makeMove({ from, to, promotion }))
    socket.on('variant:reset', () => reset())
    socket.on('variant:error', ({ message }) => setError(message))

    if (paramRoomId) {
      socket.emit('variant:join', { roomId: paramRoomId, variantId, token: getToken() })
    }

    const handleReconnect = () => {
      if ((phaseRef.current === 'playing' || phaseRef.current === 'waiting') && roomIdRef.current) {
        socket.emit('variant:join', { roomId: roomIdRef.current, variantId, token: getToken() })
      }
    }
    socket.io.on('reconnect', handleReconnect)

    return () => {
      ['variant:created','variant:joined','variant:opponentJoined','variant:opponentLeft','variant:move','variant:reset','variant:error']
        .forEach(ev => socket.off(ev))
      socket.io.off('reconnect', handleReconnect)
      socket.disconnect()
    }
  }, [])

  const handleCreateRoom = () => {
    setError('')
    socket.emit('variant:create', { token: getToken(), variantId, preferredColor: colorPref })
  }

  const handleJoinRoom = () => {
    const id = inputRoomId.trim().toUpperCase()
    if (!id) return
    setError(''); setRoomId(id)
    socket.emit('variant:join', { roomId: id, variantId, token: getToken() })
  }

  const handleMove = useCallback((move) => {
    if (!isMyTurnRef.current || isGameOverRef.current) return null
    const result = makeMove(move)
    if (result) {
      socket.emit('variant:move', { roomId: roomIdRef.current, from: move.from, to: move.to, promotion: move.promotion || 'q' })
    }
    return result
  }, [makeMove])

  const handleReset = () => { reset(); socket.emit('variant:reset', { roomId }); navigate('/variant') }

  if (!variant) return <div style={{ padding: '2rem' }}>알 수 없는 변형: {variantId}</div>

  const shareUrl = `${window.location.origin}/variant/${variantId}/online/${roomId}`

  if (phase === 'lobby') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
          <h2 className={styles.pageTitle}>{variant.label} — 친선전</h2>
          <div />
        </header>
        <div className={onlineStyles.lobby}>
          {error && <p className={onlineStyles.error}>{error}</p>}
          <div className={onlineStyles.lobbySection}>
            <h3 className={onlineStyles.sectionTitle}>새 게임 만들기</h3>
            <div className={onlineStyles.colorPicker}>
              {[{ value: 'w', label: '♔ 백' }, { value: 'random', label: '🎲 랜덤' }, { value: 'b', label: '♚ 흑' }].map(({ value, label }) => (
                <button key={value} className={`${onlineStyles.colorBtn} ${colorPref === value ? onlineStyles.colorBtnActive : ''}`} onClick={() => setColorPref(value)}>{label}</button>
              ))}
            </div>
            <button className={onlineStyles.primaryBtn} onClick={handleCreateRoom}>방 만들기</button>
          </div>
          <div className={onlineStyles.divider}>또는</div>
          <div className={onlineStyles.lobbySection}>
            <h3 className={onlineStyles.sectionTitle}>방 참가하기</h3>
            <div className={onlineStyles.joinRow}>
              <input className={onlineStyles.input} placeholder="방 코드 입력" value={inputRoomId}
                onChange={e => setInputRoomId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()} maxLength={6} />
              <button className={onlineStyles.secondaryBtn} onClick={handleJoinRoom}>참가</button>
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
          <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 나가기</button>
          <h2 className={styles.pageTitle}>상대를 기다리는 중...</h2>
          <div />
        </header>
        <div className={onlineStyles.waiting}>
          <div className={onlineStyles.roomCode}>
            <span className={onlineStyles.roomCodeLabel}>방 코드</span>
            <span className={onlineStyles.roomCodeValue}>{roomId}</span>
          </div>
          <div className={onlineStyles.shareRow}>
            <span className={onlineStyles.shareUrl}>{shareUrl}</span>
            <button className={onlineStyles.copyBtn} onClick={() => navigator.clipboard.writeText(shareUrl)}>복사</button>
          </div>
          <div className={onlineStyles.spinner} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 나가기</button>
        <h2 className={styles.pageTitle}>
          {variant.label} — 친선전
          {!opponentConnected && <span className={onlineStyles.disconnected}> (상대방 연결 끊김)</span>}
        </h2>
        <button className={styles.resetBtn} onClick={handleReset}>나가기</button>
      </header>

      {variant.BoardOverlay && <variant.BoardOverlay extraState={extraState} />}
      {variant.StatusExtra && <variant.StatusExtra extraState={extraState} />}

      {isGameOver && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-card)', marginBottom: '0.5rem', borderRadius: '8px' }}>
          {winner === 'draw' ? '무승부!' : `${winner === 'w' ? '백' : '흑'} 승리!`}
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isGameOver ? '' : `${turn === 'w' ? '백' : '흑'}의 차례`}
          </div>
          <ChessBoardWrapper
            fen={fen}
            orientation={playerColor === 'w' ? 'white' : 'black'}
            onMove={handleMove}
            getLegalMoves={isMyTurn ? getLegalMoves : undefined}
            disabled={!isMyTurn || isGameOver}
            lastMove={lastMove}
          />
        </div>
        <aside className={styles.sidebar}>
          <div className={onlineStyles.roomInfo}>
            <div className={onlineStyles.infoRow}><span className={onlineStyles.infoLabel}>방 코드</span><span className={onlineStyles.roomCodeSmall}>{roomId}</span></div>
            <div className={onlineStyles.infoRow}><span className={onlineStyles.infoLabel}>내 색상</span><span>{playerColor === 'w' ? '♔ 백' : '♚ 흑'}</span></div>
            <div className={onlineStyles.infoRow}><span className={onlineStyles.infoLabel}>상대방</span><span className={opponentConnected ? onlineStyles.online : onlineStyles.offline}>{opponentConnected ? '● 연결됨' : '○ 대기 중'}</span></div>
          </div>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
