import { Chess } from 'chess.js'
import { randomBytes } from 'crypto'

const rooms = new Map()

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let id
  do {
    id = Array.from(randomBytes(4), b => chars[b % chars.length]).join('')
  } while (rooms.has(id))
  return id
}

export function createRoom(socketId, email = null, preferredColor = 'random') {
  const roomId = generateRoomId()
  const creatorColor = preferredColor === 'w' ? 'w'
    : preferredColor === 'b' ? 'b'
    : Math.random() < 0.5 ? 'w' : 'b'
  rooms.set(roomId, {
    id: roomId,
    players: {
      w: creatorColor === 'w' ? { socketId, email } : { socketId: null, email: null },
      b: creatorColor === 'b' ? { socketId, email } : { socketId: null, email: null },
    },
    game: new Chess(),
    createdAt: Date.now(),
    finished: false,
  })
  return { roomId, creatorColor }
}

export function joinRoom(roomId, socketId, email = null) {
  const room = rooms.get(roomId)
  if (!room) return { error: '존재하지 않는 방입니다' }
  if (room.players.w.socketId && room.players.b.socketId) return { error: '방이 이미 가득 찼습니다' }
  if (room.players.w.socketId === socketId || room.players.b.socketId === socketId) return { error: '이미 방에 있습니다' }

  const color = !room.players.w.socketId ? 'w' : 'b'
  room.players[color] = { socketId, email }
  return { room, color }
}

export function getRoom(roomId) {
  return rooms.get(roomId)
}

export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.w.socketId === socketId || room.players.b.socketId === socketId) {
      return room
    }
  }
  return null
}

export function applyMove(roomId, socketId, move) {
  const room = rooms.get(roomId)
  if (!room) return { error: '방을 찾을 수 없습니다' }

  const color =
    room.players.w.socketId === socketId ? 'w'
    : room.players.b.socketId === socketId ? 'b'
    : null
  if (!color) return { error: '플레이어가 아닙니다' }
  if (room.game.turn() !== color) return { error: '당신의 차례가 아닙니다' }

  try {
    const result = room.game.move(move)
    if (!result) return { error: '유효하지 않은 이동' }

    let gameOver = null
    if (room.game.isGameOver() && !room.finished) {
      room.finished = true
      let gameResult = 'draw'
      if (room.game.isCheckmate()) {
        gameResult = room.game.turn() === 'w' ? 'black' : 'white'
      }
      gameOver = { result: gameResult, players: room.players }
    }

    return { result, fen: room.game.fen(), gameOver }
  } catch {
    return { error: '유효하지 않은 이동' }
  }
}

export function resetRoom(roomId) {
  const room = rooms.get(roomId)
  if (!room) return null
  room.game = new Chess()
  room.finished = false
  return room.game.fen()
}

export function removePlayer(socketId) {
  const room = getRoomBySocket(socketId)
  if (!room) return null

  if (room.players.w.socketId === socketId) room.players.w.socketId = null
  else if (room.players.b.socketId === socketId) room.players.b.socketId = null

  if (!room.players.w.socketId && !room.players.b.socketId) {
    rooms.delete(room.id)
    return null
  }

  return room
}

// Clean up rooms older than 2 hours
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000
  for (const [id, room] of rooms.entries()) {
    if (room.createdAt < cutoff) rooms.delete(id)
  }
}, 30 * 60 * 1000)
