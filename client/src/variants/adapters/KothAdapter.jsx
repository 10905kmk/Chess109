import { KingOfTheHill } from 'chessops/variant'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { BaseAdapter } from '../BaseAdapter.js'

const CENTER_SQUARES = new Set(['d4', 'd5', 'e4', 'e5'].map(s => parseSquare(s)))
const KOTH_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export class KothAdapter extends BaseAdapter {
  static create() {
    return KothAdapter.createFromFen(KOTH_START)
  }

  static createFromFen(fen) {
    const setup = parseFen(fen).unwrap()
    const pos = KingOfTheHill.fromSetup(setup).unwrap()
    return new KothAdapter(pos)
  }

  clone() {
    return new KothAdapter(this._pos.clone())
  }

  extraState() {
    // Find king positions to show whether either king is in the center
    let whiteKingInCenter = false
    let blackKingInCenter = false
    // Check all center squares for kings
    for (const sq of CENTER_SQUARES) {
      const piece = this._pos.board.get(sq)
      if (piece?.role === 'king') {
        if (piece.color === 'white') whiteKingInCenter = true
        else blackKingInCenter = true
      }
    }
    return { whiteKingInCenter, blackKingInCenter }
  }
}

export function KothCenterHighlight() {
  return (
    <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#d29922', margin: '0.5rem 0' }}>
      ★ 킹을 d4·d5·e4·e5로 이동하면 승리
    </div>
  )
}
