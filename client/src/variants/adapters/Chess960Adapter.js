import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { BaseAdapter } from '../BaseAdapter.js'

function generateChess960Fen() {
  const pieces = Array(8).fill(null)
  // 1. Dark-square bishop on a(0),c(2),e(4),g(6)
  const darkIdx = [0, 2, 4, 6]
  pieces[darkIdx[Math.floor(Math.random() * 4)]] = 'B'
  // 2. Light-square bishop on b(1),d(3),f(5),h(7)
  const lightIdx = [1, 3, 5, 7]
  pieces[lightIdx[Math.floor(Math.random() * 4)]] = 'B'
  // 3. Queen on random empty square
  const empty1 = pieces.flatMap((p, i) => p === null ? [i] : [])
  pieces[empty1[Math.floor(Math.random() * empty1.length)]] = 'Q'
  // 4. Two knights on random empty squares
  const empty2 = pieces.flatMap((p, i) => p === null ? [i] : [])
  const k1 = Math.floor(Math.random() * 5)
  let k2 = Math.floor(Math.random() * 4); if (k2 >= k1) k2++
  pieces[empty2[Math.min(k1, k2)]] = 'N'
  pieces[empty2[Math.max(k1, k2)]] = 'N'
  // 5. Remaining 3 squares: rook, king, rook (left to right)
  const empty3 = pieces.flatMap((p, i) => p === null ? [i] : [])
  pieces[empty3[0]] = 'R'; pieces[empty3[1]] = 'K'; pieces[empty3[2]] = 'R'
  const files = 'abcdefgh'
  const qRookFile = files[empty3[0]].toUpperCase()
  const kRookFile = files[empty3[2]].toUpperCase()
  const castling = `${kRookFile}${qRookFile}${kRookFile.toLowerCase()}${qRookFile.toLowerCase()}`
  const whiteRank = pieces.join('')
  const blackRank = whiteRank.toLowerCase()
  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w ${castling} - 0 1`
}

export class Chess960Adapter extends BaseAdapter {
  static create() {
    return Chess960Adapter.createFromFen(generateChess960Fen())
  }

  static createFromFen(fen) {
    const setup = parseFen(fen).unwrap()
    const pos = Chess.fromSetup(setup).unwrap()
    return new Chess960Adapter(pos)
  }

  clone() {
    return new Chess960Adapter(this._pos.clone())
  }
}
