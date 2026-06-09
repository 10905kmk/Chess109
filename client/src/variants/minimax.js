function evaluate(engine, color) {
  if (engine.isGameOver()) {
    const winner = engine.winner()
    if (winner === 'draw') return 0
    return winner === color ? 10000 : -10000
  }
  return 0
}

function minimax(engine, depth, alpha, beta, maximizing, aiColor) {
  if (depth === 0 || engine.isGameOver()) {
    return { score: evaluate(engine, aiColor), move: null }
  }

  const allSquares = 'abcdefgh'.split('').flatMap(f => '12345678'.split('').map(r => f + r))
  let bestMove = null

  if (maximizing) {
    let maxScore = -Infinity
    outer: for (const sq of allSquares) {
      const moves = engine.legalMoves(sq)
      for (const move of moves) {
        const clone = engine.clone()
        clone.applyMove(move)
        const { score } = minimax(clone, depth - 1, alpha, beta, false, aiColor)
        if (score > maxScore) { maxScore = score; bestMove = move }
        alpha = Math.max(alpha, score)
        if (beta <= alpha) break outer
      }
    }
    return { score: maxScore, move: bestMove }
  } else {
    let minScore = Infinity
    outer: for (const sq of allSquares) {
      const moves = engine.legalMoves(sq)
      for (const move of moves) {
        const clone = engine.clone()
        clone.applyMove(move)
        const { score } = minimax(clone, depth - 1, alpha, beta, true, aiColor)
        if (score < minScore) { minScore = score; bestMove = move }
        beta = Math.min(beta, score)
        if (beta <= alpha) break outer
      }
    }
    return { score: minScore, move: bestMove }
  }
}

export function getBestMoveSync(engine, depth = 3) {
  const aiColor = engine.turn()
  const { move } = minimax(engine.clone(), depth, -Infinity, Infinity, true, aiColor)
  return move
}
