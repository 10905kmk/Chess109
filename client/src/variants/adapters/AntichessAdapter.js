import { Antichess } from 'chessops/variant'
import { parseFen } from 'chessops/fen'
import { BaseAdapter } from '../BaseAdapter.js'

const ANTICHESS_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'

export class AntichessAdapter extends BaseAdapter {
  static create() {
    return AntichessAdapter.createFromFen(ANTICHESS_START)
  }

  static createFromFen(fen) {
    const setup = parseFen(fen).unwrap()
    const pos = Antichess.fromSetup(setup).unwrap()
    return new AntichessAdapter(pos)
  }

  clone() {
    return new AntichessAdapter(this._pos.clone())
  }

  // In Antichess, king is not royal — no check concept
  isCheck() {
    return false
  }
}
