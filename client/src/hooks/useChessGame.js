import { useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'

export function useChessGame(initialFen) {
  // useRef로 game을 보관해야 socket 리스너 등 오래된 클로저에서도 항상 최신 상태를 참조
  const gameRef = useRef(null)
  if (!gameRef.current) {
    gameRef.current = new Chess(initialFen)
  }

  // 리렌더를 강제하는 틱 카운터 (game 상태 변경 알림용)
  const [, setTick] = useState(0)
  const [history, setHistory] = useState([])
  const [capturedPieces, setCapturedPieces] = useState({ w: [], b: [] })

  // 의존성 없음 → 마운트 이후 동일한 함수 참조 유지 (stable)
  const makeMove = useCallback((move) => {
    try {
      const result = gameRef.current.move(move)
      if (!result) return null
      if (result.captured) {
        setCapturedPieces(prev => ({
          ...prev,
          [result.color]: [...prev[result.color], result.captured],
        }))
      }
      setTick(t => t + 1)
      setHistory(prev => [...prev, result])
      return result
    } catch {
      return null
    }
  }, [])

  const loadFen = useCallback((fen) => {
    gameRef.current = new Chess(fen)
    setTick(t => t + 1)
    setHistory([])
    setCapturedPieces({ w: [], b: [] })
  }, [])

  const reset = useCallback(() => {
    gameRef.current = new Chess()
    setTick(t => t + 1)
    setHistory([])
    setCapturedPieces({ w: [], b: [] })
  }, [])

  const getLegalMoves = useCallback((square) => {
    return gameRef.current.moves({ square, verbose: true })
  }, [])

  const game = gameRef.current

  return {
    game,
    fen: game.fen(),
    turn: game.turn(),
    isCheck: game.inCheck(),
    isCheckmate: game.isCheckmate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
    history,
    capturedPieces,
    makeMove,
    loadFen,
    reset,
    getLegalMoves,
  }
}
