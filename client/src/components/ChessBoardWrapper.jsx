import { useState, useCallback, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import styles from './ChessBoardWrapper.module.css'

const PROMOTION_PIECES = {
  w: [
    { key: 'q', symbol: '♕', label: '퀸' },
    { key: 'r', symbol: '♖', label: '룩' },
    { key: 'b', symbol: '♗', label: '비숍' },
    { key: 'n', symbol: '♘', label: '나이트' },
  ],
  b: [
    { key: 'q', symbol: '♛', label: '퀸' },
    { key: 'r', symbol: '♜', label: '룩' },
    { key: 'b', symbol: '♝', label: '비숍' },
    { key: 'n', symbol: '♞', label: '나이트' },
  ],
}

function getPieceAtSquare(fen, square) {
  const [position] = fen.split(' ')
  const ranks = position.split('/')
  const file = square.charCodeAt(0) - 97
  const rank = parseInt(square[1]) - 1
  const rankStr = ranks[7 - rank]
  let col = 0
  for (const ch of rankStr) {
    if (col === file) return ch
    if (/\d/.test(ch)) col += parseInt(ch)
    else col++
  }
  return null
}

function PromotionModal({ pending, fen, onSelect, onCancel }) {
  if (!pending) return null
  const piece = getPieceAtSquare(fen, pending.from)
  const color = piece === 'P' ? 'w' : 'b'
  const pieces = PROMOTION_PIECES[color]

  return (
    <div className={styles.promotionOverlay} onClick={onCancel}>
      <div className={styles.promotionModal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.promotionTitle}>프로모션 기물 선택</p>
        <div className={styles.promotionPieces}>
          {pieces.map(({ key, symbol, label }) => (
            <button
              key={key}
              className={styles.promotionBtn}
              onClick={() => onSelect(key)}
              title={label}
            >
              <span className={styles.promotionSymbol}>{symbol}</span>
              <span className={styles.promotionLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChessBoardWrapper({
  fen,
  orientation = 'white',
  onMove,
  getLegalMoves,
  disabled = false,
  lastMove = null,
  boardWidth = 560,
}) {
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [optionSquares, setOptionSquares] = useState({})
  const [pendingPromotion, setPendingPromotion] = useState(null)

  const showMoves = useCallback((square) => {
    if (!getLegalMoves) { setOptionSquares({}); return }
    const moves = getLegalMoves(square)
    if (!moves?.length) { setOptionSquares({}); return }
    const opts = {}
    moves.forEach((move) => {
      const isCapture = !!move.captured || move.flags?.includes('e')
      opts[move.to] = isCapture
        ? { background: 'radial-gradient(circle, transparent 60%, rgba(0,0,0,0.25) 60%)', borderRadius: '50%' }
        : { background: 'radial-gradient(circle, rgba(0,0,0,0.2) 30%, transparent 30%)', borderRadius: '50%' }
    })
    setOptionSquares(opts)
  }, [getLegalMoves])

  const clearSelection = useCallback(() => {
    setSelectedSquare(null)
    setOptionSquares({})
  }, [])

  const isPromotionMove = useCallback((from, to) => {
    const piece = getPieceAtSquare(fen, from)
    return (piece === 'P' && to[1] === '8') || (piece === 'p' && to[1] === '1')
  }, [fen])

  const customSquareStyles = useMemo(() => {
    const result = {}
    if (lastMove) {
      result[lastMove.from] = { backgroundColor: 'var(--last-move)' }
      result[lastMove.to] = { backgroundColor: 'var(--last-move)' }
    }
    if (selectedSquare) {
      result[selectedSquare] = { backgroundColor: 'var(--highlight)' }
    }
    Object.assign(result, optionSquares)
    return result
  }, [lastMove, selectedSquare, optionSquares])

  const onSquareClick = useCallback((square) => {
    if (disabled) return

    if (selectedSquare) {
      if (selectedSquare === square) { clearSelection(); return }

      if (isPromotionMove(selectedSquare, square)) {
        setPendingPromotion({ from: selectedSquare, to: square })
        clearSelection()
        return
      }

      const moved = onMove?.({ from: selectedSquare, to: square, promotion: 'q' })
      if (moved) { clearSelection(); return }
    }

    const piece = getPieceAtSquare(fen, square)
    if (piece) {
      setSelectedSquare(square)
      showMoves(square)
    } else {
      clearSelection()
    }
  }, [disabled, selectedSquare, fen, onMove, isPromotionMove, showMoves, clearSelection])

  const onPieceDrop = useCallback((from, to) => {
    if (disabled) return false
    // promotion handled by onPromotionCheck/onPromotionPieceSelect
    if (isPromotionMove(from, to)) return false
    const result = onMove?.({ from, to, promotion: 'q' })
    if (result) clearSelection()
    return !!result
  }, [disabled, onMove, isPromotionMove, clearSelection])

  // react-chessboard drag promotion flow
  const onPromotionCheck = useCallback((from, to) => {
    return isPromotionMove(from, to)
  }, [isPromotionMove])

  const onPromotionPieceSelect = useCallback((piece, from, to) => {
    if (!piece || !from || !to) return false
    const result = onMove?.({ from, to, promotion: piece[1].toLowerCase() })
    if (result) clearSelection()
    return !!result
  }, [onMove, clearSelection])

  // click-based promotion flow
  const handlePromotionSelect = useCallback((promotionPiece) => {
    if (!pendingPromotion) return
    const result = onMove?.({ ...pendingPromotion, promotion: promotionPiece })
    if (result) { setPendingPromotion(null); clearSelection() }
  }, [pendingPromotion, onMove, clearSelection])

  return (
    <div className={styles.boardContainer}>
      <Chessboard
        position={fen}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        onPromotionCheck={onPromotionCheck}
        onPromotionPieceSelect={onPromotionPieceSelect}
        promotionDialogVariant="modal"
        boardOrientation={orientation}
        customSquareStyles={customSquareStyles}
        boardWidth={boardWidth}
        customBoardStyle={{ borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        customDarkSquareStyle={{ backgroundColor: 'var(--black-square)' }}
        customLightSquareStyle={{ backgroundColor: 'var(--white-square)' }}
        animationDuration={150}
      />
      <PromotionModal
        pending={pendingPromotion}
        fen={fen}
        onSelect={handlePromotionSelect}
        onCancel={() => setPendingPromotion(null)}
      />
    </div>
  )
}
