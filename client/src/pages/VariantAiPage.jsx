import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVariantGame } from '../variants/useVariantGame.js'
import { useFairyStockfish } from '../variants/useFairyStockfish.js'
import { getVariant } from '../variants/index.js'
import { getBestMoveSync } from '../variants/minimax.js'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import styles from './GamePage.module.css'
import aiStyles from './AiGamePage.module.css'

const DIFFICULTIES = [
  { label: '입문', depth: 4,  skill: 0  },
  { label: '초급', depth: 7,  skill: 5  },
  { label: '중급', depth: 10, skill: 10 },
  { label: '고급', depth: 15, skill: 15 },
]

export default function VariantAiPage() {
  const navigate = useNavigate()
  const { variantId } = useParams()
  const variant = getVariant(variantId)

  const [difficulty, setDifficulty] = useState(1)
  const [playerColor, setPlayerColor] = useState('w')
  const [gameStarted, setGameStarted] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const thinkingRef = useRef(false)

  const diff = DIFFICULTIES[difficulty]

  const useFairyAi = variant?.aiType === 'fairy-stockfish'

  const { ready: fairyReady, getBestMove: getFairyMove } = useFairyStockfish(
    useFairyAi
      ? { uciVariant: variant.uciVariant, uciChess960: variant.uciChess960, depth: diff.depth, skillLevel: diff.skill }
      : { uciVariant: null }
  )

  const engineReady = useFairyAi ? fairyReady : true

  const { fen, turn, isCheck, isGameOver, winner, history, extraState, makeMove, reset, getLegalMoves, getEngine } = useVariantGame(variantId)
  const lastMove = history.length > 0 ? history[history.length - 1] : null
  const isPlayerTurn = turn === playerColor

  const isPlayerTurnRef = useRef(isPlayerTurn)
  isPlayerTurnRef.current = isPlayerTurn
  const isGameOverRef = useRef(isGameOver)
  isGameOverRef.current = isGameOver

  const doAiMove = useCallback(async (currentFen) => {
    if (thinkingRef.current) return
    thinkingRef.current = true
    setIsThinking(true)

    let move = null
    if (useFairyAi) {
      const uciMove = await getFairyMove(currentFen)
      if (uciMove) {
        move = { from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] || undefined }
      }
    } else {
      await new Promise(r => setTimeout(r, 0))
      const currentEngine = getEngine()
      if (currentEngine) {
        move = getBestMoveSync(currentEngine, 3)
      }
    }

    setIsThinking(false)
    thinkingRef.current = false
    if (move) makeMove(move)
  }, [useFairyAi, getFairyMove, makeMove, getEngine])

  useEffect(() => {
    if (!gameStarted || isGameOver || isPlayerTurn || !engineReady) return
    doAiMove(fen)
  }, [gameStarted, isGameOver, isPlayerTurn, engineReady, fen, doAiMove])

  const handleMove = useCallback((move) => {
    if (!isPlayerTurn || isGameOver) return null
    return makeMove(move)
  }, [isPlayerTurn, isGameOver, makeMove])

  const handleStart = () => { reset(); setGameStarted(true) }
  const handleReset = () => { reset(); setGameStarted(false); thinkingRef.current = false; setIsThinking(false) }

  if (!variant) return <div style={{ padding: '2rem' }}>알 수 없는 변형: {variantId}</div>

  if (!gameStarted) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
          <h2 className={styles.pageTitle}>{variant.label} — AI 대전</h2>
          <div />
        </header>
        <div className={aiStyles.setup}>
          <h3 className={aiStyles.setupTitle}>게임 설정</h3>
          <div className={aiStyles.section}>
            <label className={aiStyles.label}>색상 선택</label>
            <div className={aiStyles.colorPicker}>
              <button className={`${aiStyles.colorBtn} ${playerColor === 'w' ? aiStyles.active : ''}`} onClick={() => setPlayerColor('w')}>♔ 백 (선)</button>
              <button className={`${aiStyles.colorBtn} ${playerColor === 'b' ? aiStyles.active : ''}`} onClick={() => setPlayerColor('b')}>♚ 흑 (후)</button>
            </div>
          </div>
          <div className={aiStyles.section}>
            <label className={aiStyles.label}>난이도</label>
            <div className={aiStyles.diffPicker}>
              {DIFFICULTIES.map((d, i) => (
                <button key={d.label} className={`${aiStyles.diffBtn} ${difficulty === i ? aiStyles.active : ''}`} onClick={() => setDifficulty(i)}>{d.label}</button>
              ))}
            </div>
          </div>
          <button className={aiStyles.startBtn} onClick={handleStart} disabled={!engineReady}>
            {engineReady ? '게임 시작' : 'AI 엔진 로딩 중...'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
        <h2 className={styles.pageTitle}>
          {variant.label} — AI
          {isThinking && <span className={aiStyles.thinking}> AI 생각 중...</span>}
        </h2>
        <button className={styles.resetBtn} onClick={handleReset}>재설정</button>
      </header>

      {variant.BoardOverlay && <variant.BoardOverlay extraState={extraState} />}
      {variant.StatusExtra && <variant.StatusExtra extraState={extraState} />}

      {isGameOver && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--bg-card)', marginBottom: '0.5rem', borderRadius: '8px' }}>
          {winner === 'draw' ? '무승부!' : `${winner === 'w' ? '백' : '흑'} 승리!`}
          <button onClick={handleReset} style={{ marginLeft: '1rem' }}>다시 하기</button>
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
            orientation={playerColor === 'w' ? 'white' : 'black'}
            onMove={handleMove}
            getLegalMoves={isPlayerTurn ? getLegalMoves : undefined}
            disabled={!isPlayerTurn || isGameOver || isThinking}
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
