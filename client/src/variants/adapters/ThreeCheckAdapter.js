import { ThreeCheck } from 'chessops/variant'
import { parseFen } from 'chessops/fen'
import { BaseAdapter } from '../BaseAdapter.js'

const THREE_CHECK_START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0'

export class ThreeCheckAdapter extends BaseAdapter {
  static create() {
    return ThreeCheckAdapter.createFromFen(THREE_CHECK_START)
  }

  static createFromFen(fen) {
    const setup = parseFen(fen).unwrap()
    const pos = ThreeCheck.fromSetup(setup).unwrap()
    return new ThreeCheckAdapter(pos)
  }

  clone() {
    return new ThreeCheckAdapter(this._pos.clone())
  }

  // Returns how many times each color has been checked (0–3)
  // pos.remainingChecks: RemainingChecks { white: number, black: number }
  // values start at 3 and decrease as checks are given
  extraState() {
    const rc = this._pos.remainingChecks
    return {
      checksGiven: {
        w: 3 - (rc?.white ?? 3),
        b: 3 - (rc?.black ?? 3),
      },
    }
  }
}

// UI component: shows check count badge
export function ThreeCheckStatus({ extraState }) {
  const { checksGiven } = extraState ?? { checksGiven: { w: 0, b: 0 } }
  return (
    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', margin: '0.5rem 0', fontSize: '0.9rem', color: '#ccc' }}>
      <span>♔ 백 체크 {checksGiven.w}/3</span>
      <span>♚ 흑 체크 {checksGiven.b}/3</span>
    </div>
  )
}
