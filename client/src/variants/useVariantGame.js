import { useState, useCallback, useRef } from 'react'
import { getVariant } from './index.js'

export function useVariantGame(variantId) {
  const variant = getVariant(variantId)
  const engineRef = useRef(null)

  if (!engineRef.current && variant) {
    engineRef.current = variant.createEngine()
  }

  const [, setTick] = useState(0)
  const [history, setHistory] = useState([])
  const [extraState, setExtraState] = useState(() => engineRef.current?.extraState() ?? {})

  const makeMove = useCallback((move) => {
    if (!engineRef.current) return null
    const result = engineRef.current.applyMove(move)
    if (!result) return null
    setTick(t => t + 1)
    setHistory(prev => [...prev, result])
    setExtraState(engineRef.current.extraState())
    return result
  }, [])

  const loadFen = useCallback((fen) => {
    if (!variant) return
    engineRef.current = variant.createEngineFromFen(fen)
    setTick(t => t + 1)
    setHistory([])
    setExtraState(engineRef.current.extraState())
  }, [variant])

  const getEngine = useCallback(() => engineRef.current, [])

  const reset = useCallback(() => {
    if (!variant) return
    engineRef.current = variant.createEngine()
    setTick(t => t + 1)
    setHistory([])
    setExtraState(engineRef.current.extraState())
  }, [variant])

  const getLegalMoves = useCallback((square) => {
    return engineRef.current?.legalMoves(square) ?? []
  }, [])

  const engine = engineRef.current

  return {
    fen: engine?.fen() ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    turn: engine?.turn() ?? 'w',
    isCheck: engine?.isCheck() ?? false,
    isGameOver: engine?.isGameOver() ?? false,
    winner: engine?.winner() ?? null,
    history,
    extraState,
    makeMove,
    loadFen,
    reset,
    getLegalMoves,
    getEngine,
  }
}
