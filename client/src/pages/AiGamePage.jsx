import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChessGame } from '../hooks/useChessGame'
import { useStockfish } from '../hooks/useStockfish'
import { useAuth } from '../hooks/useAuth'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import GameStatus from '../components/GameStatus'
import styles from './GamePage.module.css'
import aiStyles from './AiGamePage.module.css'

const DIFFICULTIES = [
  { label: '입문', depth: 5, skill: 0 },
  { label: '초급', depth: 8, skill: 5 },
  { label: '중급', depth: 12, skill: 10 },
  { label: '고급', depth: 18, skill: 15 },
  { label: '전문가', depth: 22, skill: 20 },
]

export default function AiGamePage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()

  const [difficulty, setDifficulty] = useState(2)
  const [playerColor, setPlayerColor] = useState('w')
  const [gameStarted, setGameStarted] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const thinkingRef = useRef(false)
  const resultRecordedRef = useRef(false)

  const diff = DIFFICULTIES[difficulty]
  const { ready, getBestMove } = useStockfish({ depth: diff.depth, skillLevel: diff.skill })

  const {
    game, fen, turn, isCheck, isCheckmate, isDraw, isGameOver,
    history, makeMove, reset, getLegalMoves,
  } = useChessGame()

  const lastMove = history.length > 0 ? history[history.length - 1] : null
  const isPlayerTurn = turn === playerColor

  const doAiMove = useCallback(async (currentFen) => {
    if (thinkingRef.current) return
    thinkingRef.current = true
    setIsThinking(true)
    const bestMove = await getBestMove(currentFen)
    setIsThinking(false)
    thinkingRef.current = false
    if (bestMove) {
      makeMove({ from: bestMove.slice(0, 2), to: bestMove.slice(2, 4), promotion: bestMove[4] || 'q' })
    }
  }, [getBestMove, makeMove])

  useEffect(() => {
    if (!gameStarted || isGameOver || isPlayerTurn || !ready) return
    doAiMove(fen)
  }, [gameStarted, isGameOver, isPlayerTurn, ready, fen, doAiMove])

  const handleMove = useCallback((move) => {
    if (!isPlayerTurn || isGameOver) return null
    return makeMove(move)
  }, [isPlayerTurn, isGameOver, makeMove])

  const handleStart = () => {
    reset()
    setGameStarted(true)
  }

  // 게임 종료 시 결과 서버에 기록
  useEffect(() => {
    if (!isGameOver || !gameStarted || resultRecordedRef.current) return
    resultRecordedRef.current = true
    const result = isCheckmate
      ? (turn === 'w' ? 'black' : 'white')
      : 'draw'
    fetch('/api/game/result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ result, playerColor, mode: 'ai' }),
    }).catch(console.error)
  }, [isGameOver, gameStarted])

  const handleReset = () => {
    reset()
    setGameStarted(false)
    thinkingRef.current = false
    setIsThinking(false)
    resultRecordedRef.current = false
  }

  if (!gameStarted) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
          <h2 className={styles.pageTitle}>AI 대전</h2>
          <div />
        </header>

        <div className={aiStyles.setup}>
          <h3 className={aiStyles.setupTitle}>게임 설정</h3>

          <div className={aiStyles.section}>
            <label className={aiStyles.label}>색상 선택</label>
            <div className={aiStyles.colorPicker}>
              <button
                className={`${aiStyles.colorBtn} ${playerColor === 'w' ? aiStyles.active : ''}`}
                onClick={() => setPlayerColor('w')}
              >
                ♔ 백 (선)
              </button>
              <button
                className={`${aiStyles.colorBtn} ${playerColor === 'b' ? aiStyles.active : ''}`}
                onClick={() => setPlayerColor('b')}
              >
                ♚ 흑 (후)
              </button>
            </div>
          </div>

          <div className={aiStyles.section}>
            <label className={aiStyles.label}>난이도</label>
            <div className={aiStyles.diffPicker}>
              {DIFFICULTIES.map((d, i) => (
                <button
                  key={d.label}
                  className={`${aiStyles.diffBtn} ${difficulty === i ? aiStyles.active : ''}`}
                  onClick={() => setDifficulty(i)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className={aiStyles.startBtn}
            onClick={handleStart}
            disabled={!ready}
          >
            {ready ? '게임 시작' : 'Stockfish 로딩 중...'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.pageTitle}>
          AI 대전
          {isThinking && <span className={aiStyles.thinking}> AI 생각 중...</span>}
        </h2>
        <button className={styles.resetBtn} onClick={handleReset}>재설정</button>
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
            getLegalMoves={isPlayerTurn ? getLegalMoves : undefined}
            disabled={!isPlayerTurn || isGameOver || isThinking}
            lastMove={lastMove}
            isCheck={isCheck}
          />
        </div>

        <aside className={styles.sidebar}>
          <div className={aiStyles.infoCard}>
            <div className={aiStyles.infoRow}>
              <span className={aiStyles.infoLabel}>내 색상</span>
              <span>{playerColor === 'w' ? '♔ 백' : '♚ 흑'}</span>
            </div>
            <div className={aiStyles.infoRow}>
              <span className={aiStyles.infoLabel}>난이도</span>
              <span>{diff.label}</span>
            </div>
          </div>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
