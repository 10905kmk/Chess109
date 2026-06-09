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

const VARIANT_FACTORIES = {
  chess960:      (fen) => Chess.fromSetup(parseFen(fen).unwrap()).unwrap(),
  threecheck:    (fen) => ThreeCheck.fromSetup(parseFen(fen).unwrap()).unwrap(),
  kingofthehill: (fen) => KingOfTheHill.fromSetup(parseFen(fen).unwrap()).unwrap(),
  antichess:     (fen) => Antichess.fromSetup(parseFen(fen).unwrap()).unwrap(),
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

  if (!room.pos.isLegal(chessMove)) return { error: '유효하지 않은 이동' }
  room.pos.play(chessMove)

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
