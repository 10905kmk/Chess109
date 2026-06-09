import { makeFen } from 'chessops/fen'
import { makeSquare, parseSquare } from 'chessops/util'
import { makeSan } from 'chessops/san'

// Converts chessops role string to single-char used by MoveHistory captured field
const ROLE_CHAR = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }
const PROMO_ROLE = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }

export class BaseAdapter {
  // _pos: chessops Position instance
  constructor(pos) {
    this._pos = pos
  }

  // Subclasses must implement: creates adapter from an arbitrary FEN string
  // Used by useVariantGame.loadFen() for online sync
  static createFromFen(_fen) {
    throw new Error('createFromFen not implemented')
  }

  // Returns standard 6-part FEN for react-chessboard (strips variant-specific suffixes)
  fen() {
    const full = makeFen(this._pos.toSetup())
    return full.split(' ').slice(0, 6).join(' ')
  }

  turn() {
    return this._pos.turn === 'white' ? 'w' : 'b'
  }

  isCheck() {
    return this._pos.isCheck()
  }

  isGameOver() {
    return this._pos.isEnd()
  }

  // Returns 'w', 'b', 'draw', or null (game still in progress)
  winner() {
    if (!this._pos.isEnd()) return null
    const outcome = this._pos.outcome()
    if (!outcome || !outcome.winner) return 'draw'
    return outcome.winner === 'white' ? 'w' : 'b'
  }

  // Returns array of { from, to, captured? } for ChessBoardWrapper dot display
  // NOTE: chessops v0.15.0 dests(square) takes a square index and returns a SquareSet,
  // not a Map. We call dests(sq) per square rather than iterating a map.
  legalMoves(square) {
    const sq = parseSquare(square)
    if (sq === undefined) return []

    const destSet = this._pos.dests(sq)
    if (!destSet || destSet.isEmpty()) return []

    const moves = []
    for (const dest of destSet) {
      const capturedPiece = this._pos.board.get(dest)
      moves.push({
        from: square,
        to: makeSquare(dest),
        captured: capturedPiece ? ROLE_CHAR[capturedPiece.role] : undefined,
      })
    }
    return moves
  }

  // Applies move, returns move result object (chess.js-compatible shape) or null
  applyMove({ from, to, promotion }) {
    const fromSq = parseSquare(from)
    const toSq = parseSquare(to)
    if (fromSq === undefined || toSq === undefined) return null

    const chessMove = { from: fromSq, to: toSq }
    if (promotion) chessMove.promotion = PROMO_ROLE[promotion] ?? 'queen'

    // Compute SAN before mutating position
    let san
    try {
      san = makeSan(this._pos, chessMove)
    } catch {
      return null
    }

    const capturedPiece = this._pos.board.get(toSq)
    const movingPiece = this._pos.board.get(fromSq)
    const colorBefore = this._pos.turn === 'white' ? 'w' : 'b'

    try {
      this._pos.play(chessMove)
    } catch {
      return null
    }

    return {
      from,
      to,
      promotion: promotion ?? null,
      captured: capturedPiece ? ROLE_CHAR[capturedPiece.role] : null,
      color: colorBefore,
      piece: movingPiece ? ROLE_CHAR[movingPiece.role] : null,
      san,
    }
  }

  // Deep clone — subclasses override if they carry extra state
  clone() {
    return new this.constructor(this._pos.clone())
  }

  // Variant-specific extra state (e.g. check counts). Override in subclasses.
  extraState() {
    return {}
  }
}
