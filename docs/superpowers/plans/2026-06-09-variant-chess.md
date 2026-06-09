# Variant Chess Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "변형체스" lobby card with sub-menu for 4 variants (Chess960, 3-Check, KOTH, Antichess) supporting Local, AI (Fairy-Stockfish), and Online (친선전) play modes.

**Architecture:** Replace chess.js with chessops for variant game logic via a `VariantEngine` adapter interface; each variant implements the adapter so new variants need only one new file and one registry line. Fairy-Stockfish WASM handles AI for supported variants, with a generic minimax fallback for custom variants. Server-side variant rooms use a separate `variantGameManager.js` with dedicated socket events (`variant:*`), keeping existing standard-chess code untouched.

**Tech Stack:** chessops, Fairy-Stockfish WASM (Worker), React + react-chessboard, Socket.IO, Express

---

## File Map

**New — client:**
```
client/src/variants/
  index.js                     # variant registry (VARIANTS array)
  BaseAdapter.js               # shared chessops adapter logic
  adapters/
    Chess960Adapter.js
    ThreeCheckAdapter.js       # also exports ThreeCheckStatus component
    KothAdapter.js             # also exports KothCenterHighlight component
    AntichessAdapter.js
  useVariantGame.js            # React hook wrapping VariantEngine
  useFairyStockfish.js         # Fairy-Stockfish Worker hook
  minimax.js                   # generic minimax fallback AI
client/src/pages/
  VariantSelectPage.jsx
  VariantSelectPage.module.css
  VariantLocalPage.jsx
  VariantAiPage.jsx
  VariantOnlinePage.jsx
client/public/fairy-stockfish/
  fairy-stockfish.js           # downloaded from Fairy-Stockfish GitHub releases
  fairy-stockfish.wasm         # downloaded from Fairy-Stockfish GitHub releases
```

**Modified — client:**
```
client/src/App.jsx             # 4 new routes
client/src/pages/LobbyPage.jsx # 1 new MODES entry
```

**New — server:**
```
server/src/variantGameManager.js
```

**Modified — server:**
```
server/src/index.js            # variant:* socket events
```

---

## Task 1: Install chessops + Fairy-Stockfish WASM

**Files:**
- Modify: `client/package.json`
- Modify: `server/package.json`
- Create: `client/public/fairy-stockfish/` (directory with 2 files)

- [ ] **Step 1: Install chessops in client**

```bash
cd client
npm install chessops
```

Expected: `chessops` appears in `client/package.json` dependencies.

- [ ] **Step 2: Install chessops in server**

```bash
cd server
npm install chessops
```

- [ ] **Step 3: Download Fairy-Stockfish WASM files**

Go to https://github.com/fairy-stockfish/Fairy-Stockfish/releases and download the latest `fairy-stockfish.js` and `fairy-stockfish.wasm` files (or the `fairy-stockfish-nnue.js` / `.wasm` pair).

Place both files in `client/public/fairy-stockfish/`:
```
client/public/fairy-stockfish/fairy-stockfish.js
client/public/fairy-stockfish/fairy-stockfish.wasm
```

- [ ] **Step 4: Verify chessops import works**

In the client project root, run:
```bash
node -e "import('chessops/chess').then(m => console.log('OK', Object.keys(m)))"
```
Expected output includes `Chess`.

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/package-lock.json server/package.json server/package-lock.json client/public/fairy-stockfish/
git commit -m "chore: install chessops and add Fairy-Stockfish WASM"
```

---

## Task 2: BaseAdapter

**Files:**
- Create: `client/src/variants/BaseAdapter.js`

The adapter converts between the chessops Position API and the interface expected by `ChessBoardWrapper` and `useVariantGame`.

- [ ] **Step 1: Create `client/src/variants/BaseAdapter.js`**

```js
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
  legalMoves(square) {
    const sq = parseSquare(square)
    if (sq === undefined) return []
    const dests = this._pos.dests()
    const destSet = dests.get(sq)
    if (!destSet) return []

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
```

- [ ] **Step 2: Verify in browser console (after dev server is running)**

Open the browser console on any page:
```js
import('/src/variants/BaseAdapter.js').then(m => console.log('BaseAdapter OK', m))
```
Expected: logs `BaseAdapter OK` with the module.

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/BaseAdapter.js
git commit -m "feat(variants): add BaseAdapter interface"
```

---

## Task 3: Chess960Adapter

**Files:**
- Create: `client/src/variants/adapters/Chess960Adapter.js`

- [ ] **Step 1: Create `client/src/variants/adapters/Chess960Adapter.js`**

```js
import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { BaseAdapter } from '../BaseAdapter.js'

// Generates a random Chess960 starting FEN using the Scharnagl number algorithm
function generateChess960Fen() {
  const pieces = Array(8).fill(null)

  // 1. Dark-square bishop: a(0), c(2), e(4), g(6) are dark on rank 1
  const darkIdx = [0, 2, 4, 6]
  pieces[darkIdx[Math.floor(Math.random() * 4)]] = 'B'

  // 2. Light-square bishop: b(1), d(3), f(5), h(7)
  const lightIdx = [1, 3, 5, 7]
  pieces[lightIdx[Math.floor(Math.random() * 4)]] = 'B'

  // 3. Queen on random empty square
  const empty1 = pieces.flatMap((p, i) => p === null ? [i] : [])
  pieces[empty1[Math.floor(Math.random() * empty1.length)]] = 'Q'

  // 4. Two knights on random empty squares
  const empty2 = pieces.flatMap((p, i) => p === null ? [i] : [])
  const k1 = Math.floor(Math.random() * 5)
  let k2 = Math.floor(Math.random() * 4)
  if (k2 >= k1) k2++
  pieces[empty2[Math.min(k1, k2)]] = 'N'
  pieces[empty2[Math.max(k1, k2)]] = 'N'

  // 5. Remaining 3 squares: rook, king, rook (left to right)
  const empty3 = pieces.flatMap((p, i) => p === null ? [i] : [])
  pieces[empty3[0]] = 'R'
  pieces[empty3[1]] = 'K'
  pieces[empty3[2]] = 'R'

  const files = 'abcdefgh'
  // Castling: uppercase rook files for white, lowercase for black
  const qRookFile = files[empty3[0]].toUpperCase()
  const kRookFile = files[empty3[2]].toUpperCase()
  const castling = `${kRookFile}${qRookFile}${kRookFile.toLowerCase()}${qRookFile.toLowerCase()}`

  const whiteRank = pieces.join('')
  const blackRank = whiteRank.toLowerCase()

  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${whiteRank} w ${castling} - 0 1`
}

export class Chess960Adapter extends BaseAdapter {
  static create() {
    const fen = generateChess960Fen()
    return Chess960Adapter.createFromFen(fen)
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
```

- [ ] **Step 2: Verify in browser console**

```js
const { Chess960Adapter } = await import('/src/variants/adapters/Chess960Adapter.js')
const adapter = Chess960Adapter.create()
console.log('Chess960 FEN:', adapter.fen())
console.log('Turn:', adapter.turn())
console.log('Legal moves e2:', adapter.legalMoves('e2'))
```
Expected: A valid FEN string, `'w'` for turn, array of legal moves.

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/adapters/Chess960Adapter.js
git commit -m "feat(variants): add Chess960Adapter"
```

---

## Task 4: ThreeCheckAdapter + ThreeCheckStatus

**Files:**
- Create: `client/src/variants/adapters/ThreeCheckAdapter.js`

- [ ] **Step 1: Create `client/src/variants/adapters/ThreeCheckAdapter.js`**

```js
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

  // Returns how many times each color has been checked (0-3)
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

// UI component: shows check count badge in GameStatus area
export function ThreeCheckStatus({ extraState }) {
  const { checksGiven } = extraState ?? { checksGiven: { w: 0, b: 0 } }
  return (
    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', margin: '0.5rem 0', fontSize: '0.9rem', color: '#ccc' }}>
      <span>♔ 백 체크 {checksGiven.w}/3</span>
      <span>♚ 흑 체크 {checksGiven.b}/3</span>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser console**

```js
const { ThreeCheckAdapter } = await import('/src/variants/adapters/ThreeCheckAdapter.js')
const adapter = ThreeCheckAdapter.create()
console.log('ThreeCheck FEN:', adapter.fen())
console.log('Extra state:', adapter.extraState())
```
Expected: valid FEN, `checksGiven: { w: 0, b: 0 }`.

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/adapters/ThreeCheckAdapter.js
git commit -m "feat(variants): add ThreeCheckAdapter and ThreeCheckStatus"
```

---

## Task 5: KothAdapter + KothCenterHighlight

**Files:**
- Create: `client/src/variants/adapters/KothAdapter.js`

- [ ] **Step 1: Create `client/src/variants/adapters/KothAdapter.js`**

```js
import { KingOfTheHill } from 'chessops/variant'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { BaseAdapter } from '../BaseAdapter.js'

// Center squares: d4, d5, e4, e5
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
    // Find king positions
    const kings = {}
    for (const [sq, piece] of this._pos.board.pieces('white', 'king')) {
      kings.w = sq
    }
    for (const [sq, piece] of this._pos.board.pieces('black', 'king')) {
      kings.b = sq
    }
    return {
      whiteKingInCenter: kings.w !== undefined && CENTER_SQUARES.has(kings.w),
      blackKingInCenter: kings.b !== undefined && CENTER_SQUARES.has(kings.b),
    }
  }
}

// UI component: renders a subtle highlight on d4, d5, e4, e5 in the sidebar
export function KothCenterHighlight() {
  return (
    <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#d29922', margin: '0.5rem 0' }}>
      ★ 킹을 d4·d5·e4·e5로 이동하면 승리
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser console**

```js
const { KothAdapter } = await import('/src/variants/adapters/KothAdapter.js')
const adapter = KothAdapter.create()
console.log('KOTH FEN:', adapter.fen())
console.log('Extra state:', adapter.extraState())
```
Expected: valid FEN, `{ whiteKingInCenter: false, blackKingInCenter: false }`.

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/adapters/KothAdapter.js
git commit -m "feat(variants): add KothAdapter and KothCenterHighlight"
```

---

## Task 6: AntichessAdapter

**Files:**
- Create: `client/src/variants/adapters/AntichessAdapter.js`

- [ ] **Step 1: Create `client/src/variants/adapters/AntichessAdapter.js`**

```js
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

  // In Antichess, isCheck() always returns false (king is not royal)
  isCheck() {
    return false
  }
}
```

- [ ] **Step 2: Verify in browser console**

```js
const { AntichessAdapter } = await import('/src/variants/adapters/AntichessAdapter.js')
const adapter = AntichessAdapter.create()
console.log('Antichess FEN:', adapter.fen())
// If white has captures available, try a non-capture move — it should return null
const e2Moves = adapter.legalMoves('e2')
console.log('e2 legal moves:', e2Moves)
```
Expected: valid FEN, only capture moves listed if any captures are available (chessops enforces mandatory captures in Antichess).

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/adapters/AntichessAdapter.js
git commit -m "feat(variants): add AntichessAdapter"
```

---

## Task 7: Variant Registry

**Files:**
- Create: `client/src/variants/index.js`

- [ ] **Step 1: Create `client/src/variants/index.js`**

```js
import { Chess960Adapter } from './adapters/Chess960Adapter.js'
import { ThreeCheckAdapter, ThreeCheckStatus } from './adapters/ThreeCheckAdapter.js'
import { KothAdapter, KothCenterHighlight } from './adapters/KothAdapter.js'
import { AntichessAdapter } from './adapters/AntichessAdapter.js'

export const VARIANTS = [
  {
    id: 'chess960',
    label: 'Chess960',
    icon: '🎲',
    description: '기물 시작 위치 무작위 배치',
    color: '#8b5cf6',
    createEngine: () => Chess960Adapter.create(),
    createEngineFromFen: (fen) => Chess960Adapter.createFromFen(fen),
    aiType: 'fairy-stockfish',
    uciVariant: 'chess960',
    uciChess960: true,
    BoardOverlay: null,
    StatusExtra: null,
  },
  {
    id: 'threecheck',
    label: '3체크',
    icon: '✓✓✓',
    description: '체크를 3번 하면 승리',
    color: '#f85149',
    createEngine: () => ThreeCheckAdapter.create(),
    createEngineFromFen: (fen) => ThreeCheckAdapter.createFromFen(fen),
    aiType: 'fairy-stockfish',
    uciVariant: 'threecheck',
    uciChess960: false,
    BoardOverlay: null,
    StatusExtra: ThreeCheckStatus,
  },
  {
    id: 'kingofthehill',
    label: 'King of the Hill',
    icon: '⛰',
    description: '킹을 중앙 4칸으로 이동하면 승리',
    color: '#d29922',
    createEngine: () => KothAdapter.create(),
    createEngineFromFen: (fen) => KothAdapter.createFromFen(fen),
    aiType: 'fairy-stockfish',
    uciVariant: 'kingofthehill',
    uciChess960: false,
    BoardOverlay: KothCenterHighlight,
    StatusExtra: null,
  },
  {
    id: 'antichess',
    label: '안티체스',
    icon: '♟',
    description: '기물을 먼저 다 잃으면 승리',
    color: '#3fb950',
    createEngine: () => AntichessAdapter.create(),
    createEngineFromFen: (fen) => AntichessAdapter.createFromFen(fen),
    aiType: 'fairy-stockfish',
    uciVariant: 'antichess',
    uciChess960: false,
    BoardOverlay: null,
    StatusExtra: null,
  },
]

export function getVariant(id) {
  return VARIANTS.find(v => v.id === id) ?? null
}
```

- [ ] **Step 2: Verify**

```js
const { VARIANTS, getVariant } = await import('/src/variants/index.js')
console.log('Variants:', VARIANTS.map(v => v.id))
console.log('Chess960:', getVariant('chess960'))
```
Expected: `['chess960', 'threecheck', 'kingofthehill', 'antichess']`

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/index.js
git commit -m "feat(variants): add variant registry"
```

---

## Task 8: useVariantGame Hook

**Files:**
- Create: `client/src/variants/useVariantGame.js`

- [ ] **Step 1: Create `client/src/variants/useVariantGame.js`**

```js
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

  // Used by VariantOnlinePage to sync starting FEN from server (critical for Chess960)
  const loadFen = useCallback((fen) => {
    if (!variant) return
    engineRef.current = variant.createEngineFromFen(fen)
    setTick(t => t + 1)
    setHistory([])
    setExtraState(engineRef.current.extraState())
  }, [variant])

  // Exposes current engine to VariantAiPage for minimax cloning
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
```

- [ ] **Step 2: Verify (will be confirmed when pages are built in Tasks 12-14)**

No standalone verification needed — the hook is exercised through pages.

- [ ] **Step 3: Commit**

```bash
git add client/src/variants/useVariantGame.js
git commit -m "feat(variants): add useVariantGame hook"
```

---

## Task 9: useFairyStockfish Hook

**Files:**
- Create: `client/src/variants/useFairyStockfish.js`

- [ ] **Step 1: Create `client/src/variants/useFairyStockfish.js`**

```js
import { useEffect, useRef, useState, useCallback } from 'react'

const FAIRY_STOCKFISH_PATH = '/fairy-stockfish/fairy-stockfish.js'

export function useFairyStockfish({ uciVariant, uciChess960 = false, depth = 12, skillLevel = 5 } = {}) {
  const workerRef = useRef(null)
  const resolveRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const worker = new Worker(FAIRY_STOCKFISH_PATH)
    workerRef.current = worker

    worker.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? e.data : e.data?.toString?.() ?? ''
      if (msg === 'uciok') {
        if (uciVariant) worker.postMessage(`setoption name UCI_Variant value ${uciVariant}`)
        if (uciChess960) worker.postMessage('setoption name UCI_Chess960 value true')
        worker.postMessage('isready')
      } else if (msg === 'readyok') {
        worker.postMessage(`setoption name Skill Level value ${skillLevel}`)
        setReady(true)
      } else if (msg.startsWith('bestmove') && resolveRef.current) {
        const parts = msg.split(' ')
        const move = parts[1]
        resolveRef.current(move === '(none)' ? null : move)
        resolveRef.current = null
      }
    }

    worker.postMessage('uci')

    return () => {
      worker.postMessage('quit')
      worker.terminate()
    }
  }, [uciVariant, uciChess960, skillLevel])

  const getBestMove = useCallback((fen) => {
    return new Promise((resolve) => {
      if (!workerRef.current || !ready) { resolve(null); return }
      resolveRef.current = resolve
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${depth}`)
    })
  }, [ready, depth])

  const stop = useCallback(() => {
    workerRef.current?.postMessage('stop')
  }, [])

  return { ready, getBestMove, stop }
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/variants/useFairyStockfish.js
git commit -m "feat(variants): add useFairyStockfish hook"
```

---

## Task 10: Minimax Fallback AI

**Files:**
- Create: `client/src/variants/minimax.js`

- [ ] **Step 1: Create `client/src/variants/minimax.js`**

```js
// Generic minimax that works with any VariantEngine adapter.
// Depth 3 is fast enough (~100ms) for most positions.
// Evaluation is terminal-only (win/draw/loss) — sufficient for finding
// forced wins within depth; otherwise moves are effectively random.

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

// Returns a move object { from, to, promotion? } or null
export function getBestMoveSync(engine, depth = 3) {
  const aiColor = engine.turn()
  const { move } = minimax(engine.clone(), depth, -Infinity, Infinity, true, aiColor)
  return move
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/variants/minimax.js
git commit -m "feat(variants): add minimax fallback AI"
```

---

## Task 11: VariantSelectPage

**Files:**
- Create: `client/src/pages/VariantSelectPage.jsx`
- Create: `client/src/pages/VariantSelectPage.module.css`

- [ ] **Step 1: Create `client/src/pages/VariantSelectPage.jsx`**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { VARIANTS } from '../variants/index.js'
import styles from './VariantSelectPage.module.css'

const PLAY_MODES = [
  { id: 'local', label: '로컬 2인', icon: '♟', description: '같은 화면에서 번갈아 두기' },
  { id: 'ai',    label: 'AI 대전',  icon: '🤖', description: 'Fairy-Stockfish와 대결' },
  { id: 'online',label: '친선전',   icon: '🤝', description: '방 코드로 친구와 대전' },
]

export default function VariantSelectPage() {
  const navigate = useNavigate()
  const [selectedVariant, setSelectedVariant] = useState(null)

  const handleModeSelect = (modeId) => {
    if (!selectedVariant) return
    const variant = VARIANTS.find(v => v.id === selectedVariant)
    if (modeId === 'ai' && variant?.aiType === null) return
    navigate(`/variant/${selectedVariant}/${modeId}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/')}>← 로비</button>
        <h2 className={styles.title}>변형체스</h2>
        <div />
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>1단계: 변형 선택</h3>
        <div className={styles.grid}>
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              className={`${styles.card} ${selectedVariant === v.id ? styles.selected : ''}`}
              style={{ '--card-color': v.color }}
              onClick={() => setSelectedVariant(v.id)}
            >
              <span className={styles.icon}>{v.icon}</span>
              <div>
                <div className={styles.cardTitle}>{v.label}</div>
                <div className={styles.cardDesc}>{v.description}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedVariant && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>2단계: 플레이 방식</h3>
          <div className={styles.modeGrid}>
            {PLAY_MODES.map((mode) => {
              const variant = VARIANTS.find(v => v.id === selectedVariant)
              const disabled = mode.id === 'ai' && variant?.aiType === null
              return (
                <button
                  key={mode.id}
                  className={`${styles.modeCard} ${disabled ? styles.disabled : ''}`}
                  onClick={() => handleModeSelect(mode.id)}
                  disabled={disabled}
                  title={disabled ? 'AI 미지원 변형' : undefined}
                >
                  <span className={styles.modeIcon}>{mode.icon}</span>
                  <div className={styles.modeLabel}>{mode.label}</div>
                  <div className={styles.modeDesc}>{disabled ? 'AI 미지원' : mode.description}</div>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `client/src/pages/VariantSelectPage.module.css`**

```css
.page {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  padding: 1rem;
  max-width: 700px;
  margin: 0 auto;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}
.backBtn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.9rem;
}
.title { margin: 0; font-size: 1.4rem; }
.section { margin-bottom: 2rem; }
.sectionTitle { font-size: 1rem; color: var(--text-muted); margin-bottom: 1rem; }
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 2px solid transparent;
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s;
  color: var(--text);
}
.card:hover { border-color: var(--card-color); }
.card.selected { border-color: var(--card-color); background: color-mix(in srgb, var(--card-color) 10%, var(--surface)); }
.icon { font-size: 1.5rem; }
.cardTitle { font-weight: 600; font-size: 0.95rem; }
.cardDesc { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; }
.modeGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.modeCard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.2rem 0.5rem;
  border: 2px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  color: var(--text);
  transition: border-color 0.15s;
}
.modeCard:hover:not(.disabled) { border-color: var(--accent); }
.modeIcon { font-size: 1.6rem; }
.modeLabel { font-weight: 600; font-size: 0.9rem; }
.modeDesc { font-size: 0.75rem; color: var(--text-muted); text-align: center; }
.disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: Verify (after routes added in Task 15)**

Navigate to `/variant` and confirm:
- 4 variant cards display
- Clicking a variant selects it and reveals the play mode grid
- AI button is disabled only when `aiType === null`
- Clicking a play mode navigates to `/variant/{id}/{mode}`

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/VariantSelectPage.jsx client/src/pages/VariantSelectPage.module.css
git commit -m "feat(variants): add VariantSelectPage"
```

---

## Task 12: VariantLocalPage

**Files:**
- Create: `client/src/pages/VariantLocalPage.jsx`

- [ ] **Step 1: Create `client/src/pages/VariantLocalPage.jsx`**

```jsx
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVariantGame } from '../variants/useVariantGame.js'
import { getVariant } from '../variants/index.js'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import styles from './GamePage.module.css'

export default function VariantLocalPage() {
  const navigate = useNavigate()
  const { variantId } = useParams()
  const variant = getVariant(variantId)

  const { fen, turn, isCheck, isGameOver, winner, history, extraState, makeMove, reset, getLegalMoves } = useVariantGame(variantId)
  const lastMove = history.length > 0 ? history[history.length - 1] : null

  const handleMove = useCallback((move) => makeMove(move), [makeMove])

  if (!variant) {
    return <div style={{ padding: '2rem' }}>알 수 없는 변형: {variantId}</div>
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
        <h2 className={styles.pageTitle}>{variant.label} — 로컬 2인</h2>
        <button className={styles.resetBtn} onClick={reset}>초기화</button>
      </header>

      {variant.BoardOverlay && <variant.BoardOverlay extraState={extraState} />}
      {variant.StatusExtra && <variant.StatusExtra extraState={extraState} />}

      {isGameOver && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', marginBottom: '0.5rem', borderRadius: '8px' }}>
          {winner === 'draw' ? '무승부!' : `${winner === 'w' ? '백' : '흑'} 승리!`}
          <button onClick={reset} style={{ marginLeft: '1rem' }}>다시 하기</button>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isGameOver ? '' : `${turn === 'w' ? '백' : '흑'}의 차례`}
            {isCheck && !isGameOver ? ' ⚠ 체크' : ''}
          </div>
          <ChessBoardWrapper
            fen={fen}
            onMove={handleMove}
            getLegalMoves={getLegalMoves}
            disabled={isGameOver}
            lastMove={lastMove}
          />
        </div>
        <aside className={styles.sidebar}>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify (after routes in Task 15)**

Navigate to `/variant/threecheck/local`. Play a few moves. Confirm:
- ThreeCheckStatus shows check counts updating
- Game ends and shows winner when a player is checked 3 times

Navigate to `/variant/antichess/local`. Confirm captures are mandatory (only capture moves shown when captures available).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/VariantLocalPage.jsx
git commit -m "feat(variants): add VariantLocalPage"
```

---

## Task 13: VariantAiPage

**Files:**
- Create: `client/src/pages/VariantAiPage.jsx`

- [ ] **Step 1: Create `client/src/pages/VariantAiPage.jsx`**

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVariantGame } from '../variants/useVariantGame.js'
import { useFairyStockfish } from '../variants/useFairyStockfish.js'
import { getVariant } from '../variants/index.js'
import { getBestMoveSync } from '../variants/minimax.js'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import styles from './GamePage.module.css'
import aiStyles from './AiGamePage.module.css'

const DIFFICULTIES = [
  { label: '입문', depth: 4,  skill: 0  },
  { label: '초급', depth: 7,  skill: 5  },
  { label: '중급', depth: 10, skill: 10 },
  { label: '고급', depth: 15, skill: 15 },
]

export default function VariantAiPage() {
  const navigate = useNavigate()
  const { variantId } = useParams()
  const variant = getVariant(variantId)

  const [difficulty, setDifficulty] = useState(1)
  const [playerColor, setPlayerColor] = useState('w')
  const [gameStarted, setGameStarted] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const thinkingRef = useRef(false)

  const diff = DIFFICULTIES[difficulty]

  const useFairyAi = variant?.aiType === 'fairy-stockfish'

  const { ready: fairyReady, getBestMove: getFairyMove } = useFairyStockfish(
    useFairyAi
      ? { uciVariant: variant.uciVariant, uciChess960: variant.uciChess960, depth: diff.depth, skillLevel: diff.skill }
      : { uciVariant: null }
  )

  const engineReady = useFairyAi ? fairyReady : true

  const { fen, turn, isCheck, isGameOver, winner, history, extraState, makeMove, reset, getLegalMoves, getEngine } = useVariantGame(variantId)
  const lastMove = history.length > 0 ? history[history.length - 1] : null
  const isPlayerTurn = turn === playerColor

  // Ref-based access for stable AI callback
  const engineRef = useRef(null)
  const isPlayerTurnRef = useRef(isPlayerTurn)
  isPlayerTurnRef.current = isPlayerTurn
  const isGameOverRef = useRef(isGameOver)
  isGameOverRef.current = isGameOver

  const doAiMove = useCallback(async (currentFen) => {
    if (thinkingRef.current) return
    thinkingRef.current = true
    setIsThinking(true)

    let move = null
    if (useFairyAi) {
      const uciMove = await getFairyMove(currentFen)
      if (uciMove) {
        move = { from: uciMove.slice(0, 2), to: uciMove.slice(2, 4), promotion: uciMove[4] || undefined }
      }
    } else {
      // Minimax fallback: clone current game state and search
      await new Promise(r => setTimeout(r, 0)) // yield to keep UI responsive
      const currentEngine = getEngine()
      if (currentEngine) {
        move = getBestMoveSync(currentEngine, 3)
      }
    }

    setIsThinking(false)
    thinkingRef.current = false
    if (move) makeMove(move)
  }, [useFairyAi, getFairyMove, makeMove, variant])

  useEffect(() => {
    if (!gameStarted || isGameOver || isPlayerTurn || !engineReady) return
    doAiMove(fen)
  }, [gameStarted, isGameOver, isPlayerTurn, engineReady, fen, doAiMove])

  const handleMove = useCallback((move) => {
    if (!isPlayerTurn || isGameOver) return null
    return makeMove(move)
  }, [isPlayerTurn, isGameOver, makeMove])

  const handleStart = () => { reset(); setGameStarted(true) }
  const handleReset = () => { reset(); setGameStarted(false); thinkingRef.current = false; setIsThinking(false) }

  if (!variant) return <div style={{ padding: '2rem' }}>알 수 없는 변형: {variantId}</div>

  if (!gameStarted) {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
          <h2 className={styles.pageTitle}>{variant.label} — AI 대전</h2>
          <div />
        </header>
        <div className={aiStyles.setup}>
          <h3 className={aiStyles.setupTitle}>게임 설정</h3>
          <div className={aiStyles.section}>
            <label className={aiStyles.label}>색상 선택</label>
            <div className={aiStyles.colorPicker}>
              <button className={`${aiStyles.colorBtn} ${playerColor === 'w' ? aiStyles.active : ''}`} onClick={() => setPlayerColor('w')}>♔ 백 (선)</button>
              <button className={`${aiStyles.colorBtn} ${playerColor === 'b' ? aiStyles.active : ''}`} onClick={() => setPlayerColor('b')}>♚ 흑 (후)</button>
            </div>
          </div>
          <div className={aiStyles.section}>
            <label className={aiStyles.label}>난이도</label>
            <div className={aiStyles.diffPicker}>
              {DIFFICULTIES.map((d, i) => (
                <button key={d.label} className={`${aiStyles.diffBtn} ${difficulty === i ? aiStyles.active : ''}`} onClick={() => setDifficulty(i)}>{d.label}</button>
              ))}
            </div>
          </div>
          <button className={aiStyles.startBtn} onClick={handleStart} disabled={!engineReady}>
            {engineReady ? '게임 시작' : 'AI 엔진 로딩 중...'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
        <h2 className={styles.pageTitle}>
          {variant.label} — AI
          {isThinking && <span className={aiStyles.thinking}> AI 생각 중...</span>}
        </h2>
        <button className={styles.resetBtn} onClick={handleReset}>재설정</button>
      </header>

      {variant.BoardOverlay && <variant.BoardOverlay extraState={extraState} />}
      {variant.StatusExtra && <variant.StatusExtra extraState={extraState} />}

      {isGameOver && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', marginBottom: '0.5rem', borderRadius: '8px' }}>
          {winner === 'draw' ? '무승부!' : `${winner === 'w' ? '백' : '흑'} 승리!`}
          <button onClick={handleReset} style={{ marginLeft: '1rem' }}>다시 하기</button>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isGameOver ? '' : `${turn === 'w' ? '백' : '흑'}의 차례`}
            {isCheck && !isGameOver ? ' ⚠ 체크' : ''}
          </div>
          <ChessBoardWrapper
            fen={fen}
            orientation={playerColor === 'w' ? 'white' : 'black'}
            onMove={handleMove}
            getLegalMoves={isPlayerTurn ? getLegalMoves : undefined}
            disabled={!isPlayerTurn || isGameOver || isThinking}
            lastMove={lastMove}
          />
        </div>
        <aside className={styles.sidebar}>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/VariantAiPage.jsx
git commit -m "feat(variants): add VariantAiPage"
```

---

## Task 14: VariantOnlinePage

**Files:**
- Create: `client/src/pages/VariantOnlinePage.jsx`

- [ ] **Step 1: Create `client/src/pages/VariantOnlinePage.jsx`**

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useVariantGame } from '../variants/useVariantGame.js'
import { getVariant } from '../variants/index.js'
import { useAuth } from '../hooks/useAuth'
import { socket } from '../lib/socket'
import ChessBoardWrapper from '../components/ChessBoardWrapper'
import MoveHistory from '../components/MoveHistory'
import styles from './GamePage.module.css'
import onlineStyles from './OnlineGamePage.module.css'

export default function VariantOnlinePage() {
  const navigate = useNavigate()
  const { variantId, roomId: paramRoomId } = useParams()
  const { getToken } = useAuth()
  const variant = getVariant(variantId)

  const [phase, setPhase] = useState(paramRoomId ? 'joining' : 'lobby')
  const [roomId, setRoomId] = useState(paramRoomId || '')
  const [inputRoomId, setInputRoomId] = useState('')
  const [playerColor, setPlayerColor] = useState(null)
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [error, setError] = useState('')
  const [colorPref, setColorPref] = useState('random')

  const { fen, turn, isGameOver, winner, history, extraState, makeMove, loadFen, reset, getLegalMoves } = useVariantGame(variantId)
  const lastMove = history.length > 0 ? history[history.length - 1] : null
  const isMyTurn = playerColor && turn === playerColor && opponentConnected

  const roomIdRef = useRef(roomId)
  roomIdRef.current = roomId
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn
  const isGameOverRef = useRef(isGameOver)
  isGameOverRef.current = isGameOver

  useEffect(() => {
    socket.connect()

    socket.on('variant:created', ({ roomId: id, color, startFen }) => {
      setRoomId(id); setPlayerColor(color); setPhase('waiting')
      if (startFen) loadFen(startFen)  // Chess960: sync server-generated starting position
    })
    socket.on('variant:joined', ({ color, roomId: joinedRoomId, startFen }) => {
      if (joinedRoomId) setRoomId(joinedRoomId)
      setPlayerColor(color); setOpponentConnected(true); setPhase('playing')
      if (startFen) loadFen(startFen)  // Chess960: sync server-generated starting position
    })
    socket.on('variant:opponentJoined', () => { setOpponentConnected(true); setPhase('playing') })
    socket.on('variant:opponentLeft', () => setOpponentConnected(false))
    socket.on('variant:move', ({ from, to, promotion }) => makeMove({ from, to, promotion }))
    socket.on('variant:reset', () => reset())
    socket.on('variant:error', ({ message }) => setError(message))

    if (paramRoomId) {
      socket.emit('variant:join', { roomId: paramRoomId, variantId, token: getToken() })
    }

    const handleReconnect = () => {
      if ((phaseRef.current === 'playing' || phaseRef.current === 'waiting') && roomIdRef.current) {
        socket.emit('variant:join', { roomId: roomIdRef.current, variantId, token: getToken() })
      }
    }
    socket.io.on('reconnect', handleReconnect)

    return () => {
      ['variant:created','variant:joined','variant:opponentJoined','variant:opponentLeft','variant:move','variant:reset','variant:error']
        .forEach(ev => socket.off(ev))
      socket.io.off('reconnect', handleReconnect)
      socket.disconnect()
    }
  }, [])

  const handleCreateRoom = () => {
    setError('')
    socket.emit('variant:create', { token: getToken(), variantId, preferredColor: colorPref })
  }

  const handleJoinRoom = () => {
    const id = inputRoomId.trim().toUpperCase()
    if (!id) return
    setError(''); setRoomId(id)
    socket.emit('variant:join', { roomId: id, variantId, token: getToken() })
  }

  const handleMove = useCallback((move) => {
    if (!isMyTurnRef.current || isGameOverRef.current) return null
    const result = makeMove(move)
    if (result) {
      socket.emit('variant:move', { roomId: roomIdRef.current, from: move.from, to: move.to, promotion: move.promotion || 'q' })
    }
    return result
  }, [makeMove])

  const handleReset = () => { reset(); socket.emit('variant:reset', { roomId }); navigate('/variant') }

  if (!variant) return <div style={{ padding: '2rem' }}>알 수 없는 변형: {variantId}</div>

  const shareUrl = `${window.location.origin}/variant/${variantId}/online/${roomId}`

  if (phase === 'lobby') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 변형 선택</button>
          <h2 className={styles.pageTitle}>{variant.label} — 친선전</h2>
          <div />
        </header>
        <div className={onlineStyles.lobby}>
          {error && <p className={onlineStyles.error}>{error}</p>}
          <div className={onlineStyles.lobbySection}>
            <h3 className={onlineStyles.sectionTitle}>새 게임 만들기</h3>
            <div className={onlineStyles.colorPicker}>
              {[{ value: 'w', label: '♔ 백' }, { value: 'random', label: '🎲 랜덤' }, { value: 'b', label: '♚ 흑' }].map(({ value, label }) => (
                <button key={value} className={`${onlineStyles.colorBtn} ${colorPref === value ? onlineStyles.colorBtnActive : ''}`} onClick={() => setColorPref(value)}>{label}</button>
              ))}
            </div>
            <button className={onlineStyles.primaryBtn} onClick={handleCreateRoom}>방 만들기</button>
          </div>
          <div className={onlineStyles.divider}>또는</div>
          <div className={onlineStyles.lobbySection}>
            <h3 className={onlineStyles.sectionTitle}>방 참가하기</h3>
            <div className={onlineStyles.joinRow}>
              <input className={onlineStyles.input} placeholder="방 코드 입력" value={inputRoomId}
                onChange={e => setInputRoomId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()} maxLength={6} />
              <button className={onlineStyles.secondaryBtn} onClick={handleJoinRoom}>참가</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'waiting') {
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 나가기</button>
          <h2 className={styles.pageTitle}>상대를 기다리는 중...</h2>
          <div />
        </header>
        <div className={onlineStyles.waiting}>
          <div className={onlineStyles.roomCode}>
            <span className={onlineStyles.roomCodeLabel}>방 코드</span>
            <span className={onlineStyles.roomCodeValue}>{roomId}</span>
          </div>
          <div className={onlineStyles.shareRow}>
            <span className={onlineStyles.shareUrl}>{shareUrl}</span>
            <button className={onlineStyles.copyBtn} onClick={() => navigator.clipboard.writeText(shareUrl)}>복사</button>
          </div>
          <div className={onlineStyles.spinner} />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/variant')}>← 나가기</button>
        <h2 className={styles.pageTitle}>
          {variant.label} — 친선전
          {!opponentConnected && <span className={onlineStyles.disconnected}> (상대방 연결 끊김)</span>}
        </h2>
        <button className={styles.resetBtn} onClick={handleReset}>나가기</button>
      </header>

      {variant.BoardOverlay && <variant.BoardOverlay extraState={extraState} />}
      {variant.StatusExtra && <variant.StatusExtra extraState={extraState} />}

      {isGameOver && (
        <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', marginBottom: '0.5rem', borderRadius: '8px' }}>
          {winner === 'draw' ? '무승부!' : `${winner === 'w' ? '백' : '흑'} 승리!`}
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.boardSection}>
          <div style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isGameOver ? '' : `${turn === 'w' ? '백' : '흑'}의 차례`}
          </div>
          <ChessBoardWrapper
            fen={fen}
            orientation={playerColor === 'w' ? 'white' : 'black'}
            onMove={handleMove}
            getLegalMoves={isMyTurn ? getLegalMoves : undefined}
            disabled={!isMyTurn || isGameOver}
            lastMove={lastMove}
          />
        </div>
        <aside className={styles.sidebar}>
          <div className={onlineStyles.roomInfo}>
            <div className={onlineStyles.infoRow}><span className={onlineStyles.infoLabel}>방 코드</span><span className={onlineStyles.roomCodeSmall}>{roomId}</span></div>
            <div className={onlineStyles.infoRow}><span className={onlineStyles.infoLabel}>내 색상</span><span>{playerColor === 'w' ? '♔ 백' : '♚ 흑'}</span></div>
            <div className={onlineStyles.infoRow}><span className={onlineStyles.infoLabel}>상대방</span><span className={opponentConnected ? onlineStyles.online : onlineStyles.offline}>{opponentConnected ? '● 연결됨' : '○ 대기 중'}</span></div>
          </div>
          <MoveHistory history={history} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/pages/VariantOnlinePage.jsx
git commit -m "feat(variants): add VariantOnlinePage"
```

---

## Task 15: Routes + Lobby Card

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/pages/LobbyPage.jsx`

- [ ] **Step 1: Add routes to `client/src/App.jsx`**

Add these imports after the existing page imports:
```js
import VariantSelectPage from './pages/VariantSelectPage'
import VariantLocalPage from './pages/VariantLocalPage'
import VariantAiPage from './pages/VariantAiPage'
import VariantOnlinePage from './pages/VariantOnlinePage'
```

Add these routes inside the `<Routes>` block (after the existing `/feedback` route):
```jsx
<Route path="/variant" element={<RequireAuth><VariantSelectPage /></RequireAuth>} />
<Route path="/variant/:variantId/local" element={<RequireAuth><VariantLocalPage /></RequireAuth>} />
<Route path="/variant/:variantId/ai" element={<RequireAuth><VariantAiPage /></RequireAuth>} />
<Route path="/variant/:variantId/online" element={<RequireAuth><VariantOnlinePage /></RequireAuth>} />
<Route path="/variant/:variantId/online/:roomId" element={<RequireAuth><VariantOnlinePage /></RequireAuth>} />
```

- [ ] **Step 2: Add variant card to `client/src/pages/LobbyPage.jsx`**

In the `MODES` array, add this entry after the `local` entry:
```js
{
  id: 'variant',
  label: '변형체스',
  icon: '♞',
  description: '960, 3체크, KOTH, 안티체스',
  color: '#8b5cf6',
},
```

Change `navigate(`/${mode.id}`)` in the onClick handler to handle the variant route:
```js
onClick={() => !disabled && navigate(mode.id === 'variant' ? '/variant' : `/${mode.id}`)}
```

- [ ] **Step 3: Verify end-to-end**

Start the dev server: `cd client && npm run dev`

Checklist:
- [ ] Lobby shows "변형체스" card (purple, ♞)
- [ ] Clicking navigates to `/variant`
- [ ] Selecting Chess960 → 로컬 2인 → board shows random starting position
- [ ] Selecting 3체크 → 로컬 2인 → ThreeCheck counter visible → game ends at 3 checks
- [ ] Selecting KOTH → 로컬 2인 → "킹을 중앙으로..." hint visible
- [ ] Selecting 안티체스 → 로컬 2인 → captures are mandatory

- [ ] **Step 4: Commit**

```bash
git add client/src/App.jsx client/src/pages/LobbyPage.jsx
git commit -m "feat(variants): wire up routes and lobby card"
```

---

## Task 16: variantGameManager.js (Server)

**Files:**
- Create: `server/src/variantGameManager.js`

- [ ] **Step 1: Create `server/src/variantGameManager.js`**

```js
import { Chess } from 'chessops/chess'
import { ThreeCheck, KingOfTheHill, Antichess } from 'chessops/variant'
import { parseFen } from 'chessops/fen'
import { parseSquare } from 'chessops/util'
import { randomBytes } from 'crypto'

const variantRooms = new Map()

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id
  do {
    id = Array.from(randomBytes(4), b => chars[b % chars.length]).join('')
  } while (variantRooms.has(id))
  return id
}

// Maps variantId → chessops Position factory
const VARIANT_FACTORIES = {
  chess960:      (fen) => Chess.fromSetup(parseFen(fen).unwrap()).unwrap(),
  threecheck:    (fen) => ThreeCheck.fromSetup(parseFen(fen).unwrap()).unwrap(),
  kingofthehill: (fen) => KingOfTheHill.fromSetup(parseFen(fen).unwrap()).unwrap(),
  antichess:     (fen) => Antichess.fromSetup(parseFen(fen).unwrap()).unwrap(),
}

const VARIANT_START_FENS = {
  threecheck:    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0',
  kingofthehill: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  antichess:     'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
}

function createPosition(variantId, fen) {
  const factory = VARIANT_FACTORIES[variantId]
  if (!factory) throw new Error(`Unknown variant: ${variantId}`)
  return factory(fen)
}

export function createVariantRoom(socketId, variantId, startFen, email = null, preferredColor = 'random') {
  const roomId = generateRoomId()
  const creatorColor = preferredColor === 'w' ? 'w' : preferredColor === 'b' ? 'b' : (Math.random() < 0.5 ? 'w' : 'b')
  const pos = createPosition(variantId, startFen)

  variantRooms.set(roomId, {
    id: roomId,
    variantId,
    startFen,
    pos,
    players: {
      w: creatorColor === 'w' ? { socketId, email } : { socketId: null, email: null },
      b: creatorColor === 'b' ? { socketId, email } : { socketId: null, email: null },
    },
    createdAt: Date.now(),
    finished: false,
  })

  return { roomId, creatorColor }
}

export function joinVariantRoom(roomId, socketId, email = null) {
  const room = variantRooms.get(roomId)
  if (!room) return { error: '존재하지 않는 방입니다' }
  if (room.players.w.socketId && room.players.b.socketId) return { error: '방이 이미 가득 찼습니다' }
  if (room.players.w.socketId === socketId || room.players.b.socketId === socketId) return { error: '이미 방에 있습니다' }

  const color = !room.players.w.socketId ? 'w' : 'b'
  room.players[color] = { socketId, email }
  return { room, color }
}

export function getVariantRoom(roomId) {
  return variantRooms.get(roomId)
}

export function getVariantRoomBySocket(socketId) {
  for (const room of variantRooms.values()) {
    if (room.players.w.socketId === socketId || room.players.b.socketId === socketId) return room
  }
  return null
}

export function applyVariantMove(roomId, socketId, move) {
  const room = variantRooms.get(roomId)
  if (!room) return { error: '방을 찾을 수 없습니다' }

  const color = room.players.w.socketId === socketId ? 'w' : room.players.b.socketId === socketId ? 'b' : null
  if (!color) return { error: '플레이어가 아닙니다' }
  if ((room.pos.turn === 'white' ? 'w' : 'b') !== color) return { error: '당신의 차례가 아닙니다' }

  const PROMO_ROLE = { q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }
  const fromSq = parseSquare(move.from)
  const toSq = parseSquare(move.to)
  if (fromSq === undefined || toSq === undefined) return { error: '유효하지 않은 이동' }

  const chessMove = { from: fromSq, to: toSq }
  if (move.promotion) chessMove.promotion = PROMO_ROLE[move.promotion] ?? 'queen'

  try {
    room.pos.play(chessMove)
  } catch {
    return { error: '유효하지 않은 이동' }
  }

  let gameOver = null
  if (room.pos.isEnd() && !room.finished) {
    room.finished = true
    const outcome = room.pos.outcome()
    let result = 'draw'
    if (outcome?.winner) result = outcome.winner === 'white' ? 'white' : 'black'
    gameOver = { result, players: room.players }
  }

  return { gameOver }
}

export function resetVariantRoom(roomId) {
  const room = variantRooms.get(roomId)
  if (!room) return false
  room.pos = createPosition(room.variantId, room.startFen)
  room.finished = false
  return true
}

export function removeVariantPlayer(socketId) {
  const room = getVariantRoomBySocket(socketId)
  if (!room) return null
  if (room.players.w.socketId === socketId) room.players.w.socketId = null
  else if (room.players.b.socketId === socketId) room.players.b.socketId = null
  if (!room.players.w.socketId && !room.players.b.socketId) {
    variantRooms.delete(room.id)
    return null
  }
  return room
}

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, room] of variantRooms.entries()) {
    if (room.createdAt < cutoff) variantRooms.delete(id)
  }
}, 30 * 60 * 1000)
```

- [ ] **Step 2: Commit**

```bash
git add server/src/variantGameManager.js
git commit -m "feat(variants): add variantGameManager"
```

---

## Task 17: Server — Variant Socket Events

**Files:**
- Modify: `server/src/index.js`

- [ ] **Step 1: Add variantGameManager imports to `server/src/index.js`**

Add after the existing gameManager import line:
```js
import {
  createVariantRoom, joinVariantRoom, getVariantRoomBySocket,
  applyVariantMove, resetVariantRoom, removeVariantPlayer,
} from './variantGameManager.js'
```

- [ ] **Step 2: Add variant Chess960 FEN generator import**

The server needs the Chess960 starting FEN. Add a simple generator inline in index.js, or import a shared utility. For simplicity, add it inline after the variantGameManager import:

```js
// Chess960 starting FEN generator (mirrors client-side logic)
function generateChess960Fen() {
  const pieces = Array(8).fill(null)
  const darkIdx = [0, 2, 4, 6]; pieces[darkIdx[Math.floor(Math.random() * 4)]] = 'B'
  const lightIdx = [1, 3, 5, 7]; pieces[lightIdx[Math.floor(Math.random() * 4)]] = 'B'
  const empty1 = pieces.flatMap((p, i) => p === null ? [i] : [])
  pieces[empty1[Math.floor(Math.random() * empty1.length)]] = 'Q'
  const empty2 = pieces.flatMap((p, i) => p === null ? [i] : [])
  const k1 = Math.floor(Math.random() * 5); let k2 = Math.floor(Math.random() * 4); if (k2 >= k1) k2++
  pieces[empty2[Math.min(k1, k2)]] = 'N'; pieces[empty2[Math.max(k1, k2)]] = 'N'
  const empty3 = pieces.flatMap((p, i) => p === null ? [i] : [])
  pieces[empty3[0]] = 'R'; pieces[empty3[1]] = 'K'; pieces[empty3[2]] = 'R'
  const files = 'abcdefgh'
  const qR = files[empty3[0]].toUpperCase(); const kR = files[empty3[2]].toUpperCase()
  const castling = `${kR}${qR}${kR.toLowerCase()}${qR.toLowerCase()}`
  const w = pieces.join(''); const b = w.toLowerCase()
  return `${b}/pppppppp/8/8/8/8/PPPPPPPP/${w} w ${castling} - 0 1`
}

const VARIANT_START_FENS = {
  chess960:      null, // generated per room
  threecheck:    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0',
  kingofthehill: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  antichess:     'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
}
```

- [ ] **Step 3: Add variant socket handlers inside `io.on('connection', ...)` block**

Add these handlers after the existing `socket.on('game:reset', ...)` handler:

```js
socket.on('variant:create', ({ token, variantId, preferredColor = 'random' } = {}) => {
  const payload = verifyToken(token)
  const startFen = variantId === 'chess960' ? generateChess960Fen() : VARIANT_START_FENS[variantId]
  if (!startFen) { socket.emit('variant:error', { message: '알 수 없는 변형입니다' }); return }
  const { roomId, creatorColor } = createVariantRoom(socket.id, variantId, startFen, payload?.email ?? null, preferredColor)
  socket.join(roomId)
  // Send startFen so client can sync (critical for Chess960 where server generates the position)
  socket.emit('variant:created', { roomId, color: creatorColor, startFen })
})

socket.on('variant:join', ({ roomId, variantId, token }) => {
  const payload = verifyToken(token)
  const result = joinVariantRoom(roomId, socket.id, payload?.email ?? null)
  if (result.error) { socket.emit('variant:error', { message: result.error }); return }
  socket.join(roomId)
  // Include startFen so joining player loads the same board as the room creator
  socket.emit('variant:joined', { color: result.color, roomId, startFen: result.room.startFen })
  socket.to(roomId).emit('variant:opponentJoined', { color: result.color })
})

socket.on('variant:move', ({ roomId, from, to, promotion }) => {
  const result = applyVariantMove(roomId, socket.id, { from, to, promotion: promotion || 'q' })
  if (result.error) { socket.emit('variant:error', { message: result.error }); return }
  socket.to(roomId).emit('variant:move', { from, to, promotion })
  if (result.gameOver) {
    io.to(roomId).emit('game:over', { result: result.gameOver.result })
  }
})

socket.on('variant:reset', ({ roomId }) => {
  const ok = resetVariantRoom(roomId)
  if (ok) io.to(roomId).emit('variant:reset')
})
```

- [ ] **Step 4: Add variant room cleanup to the `disconnect` handler**

In the existing `socket.on('disconnect', ...)` handler, after the existing `removePlayer` call, add:
```js
const variantRoom = removeVariantPlayer(socket.id)
if (variantRoom) {
  io.to(variantRoom.id).emit('variant:opponentLeft')
}
```

- [ ] **Step 5: Start server and verify**

```bash
cd server && npm run dev
```

Expected: server starts without errors.

- [ ] **Step 6: End-to-end online test**

Open two browser tabs. In both, navigate to `/ → 변형체스 → 3체크 → 친선전`.
- Tab 1: 방 만들기 → copy the share URL
- Tab 2: paste URL → joins the room
- Confirm both tabs show the board and take turns
- Confirm check count updates on both sides

- [ ] **Step 7: Commit**

```bash
git add server/src/index.js
git commit -m "feat(variants): add variant socket events to server"
```

---

## Implementation Complete

After all tasks pass verification:

```bash
git log --oneline
```

Expected: 17 commits on `feat/variant-chess`, all variant features complete.
