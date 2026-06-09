import { Chess960Adapter } from './adapters/Chess960Adapter.js'
import { ThreeCheckAdapter, ThreeCheckStatus } from './adapters/ThreeCheckAdapter.jsx'
import { KothAdapter, KothCenterHighlight } from './adapters/KothAdapter.jsx'
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
