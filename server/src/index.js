import 'dotenv/config'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import {
  createRoom, joinRoom, getRoom, getRoomBySocket,
  applyMove, resetRoom, removePlayer,
} from './gameManager.js'
import {
  createVariantRoom, joinVariantRoom, getVariantRoomBySocket,
  applyVariantMove, resetVariantRoom, removeVariantPlayer,
} from './variantGameManager.js'
import { superschoolAuth } from './superschool.js'
import { upsertUser, recordGame, getRanking, getUserStats } from './db.js'

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
  chess960:      null,
  threecheck:    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 +0+0',
  kingofthehill: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  antichess:     'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1',
}

const JWT_SECRET = process.env.JWT_SECRET || 'chess109-dev-secret-change-in-prod'
const JWT_EXPIRES = '7d'

const app = express()
const httpServer = createServer(app)

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

const CORS_ORIGINS = process.env.NODE_ENV === 'production'
  ? CLIENT_URL
  : [CLIENT_URL, 'http://localhost:5174', 'http://localhost:5175']

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
})

app.use(cors({ origin: CORS_ORIGINS, credentials: true }))
app.use(cookieParser())
app.use(express.json())

app.get('/health', (_, res) => res.json({ ok: true }))

// ── Auth middleware ───────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.chess109_token
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  const token = cookieToken ?? bearerToken
  if (!token) return res.status(401).json({ error: '인증 필요' })
  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: '토큰이 유효하지 않습니다' })
  }
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET) } catch { return null }
}

// ── Auth routes ───────────────────────────────────────────────────────────────

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
}

app.post('/auth/login', async (req, res) => {
  const { loginId, password } = req.body ?? {}
  if (!loginId || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력하세요' })
  }
  try {
    const ssUser = await superschoolAuth(loginId, password)
    const user   = await upsertUser(ssUser)
    const { createdAt, lastLogin, ...jwtPayload } = user
    const token  = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
    res.cookie('chess109_token', token, COOKIE_OPTS)
    res.json({ token, user })
  } catch (err) {
    const status = err.status === 401 ? 401 : 400
    res.status(status).json({ error: err.message || '로그인에 실패했습니다' })
  }
})

app.get('/auth/me', (req, res) => {
  const cookieToken = req.cookies?.chess109_token
  const bearerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  const token = cookieToken ?? bearerToken
  if (!token) return res.status(401).json({ error: '인증 필요' })
  try {
    const user = jwt.verify(token, JWT_SECRET)
    const { iat, exp, ...userFields } = user
    res.json({ user: userFields, token })
  } catch {
    res.status(401).json({ error: '토큰이 유효하지 않습니다' })
  }
})

app.post('/auth/logout', (req, res) => {
  res.clearCookie('chess109_token', COOKIE_OPTS)
  res.json({ ok: true })
})

// ── Game / ranking routes ─────────────────────────────────────────────────────

app.post('/api/game/result', requireAuth, async (req, res) => {
  const { result, playerColor, mode } = req.body ?? {}
  if (!['white', 'black', 'draw'].includes(result)) {
    return res.status(400).json({ error: '잘못된 결과값' })
  }
  if (!['w', 'b'].includes(playerColor)) {
    return res.status(400).json({ error: '잘못된 색상' })
  }
  if (!['ai'].includes(mode)) {
    return res.status(400).json({ error: '잘못된 모드 (클라이언트에서는 ai만 가능)' })
  }
  try {
    const email = req.user.email
    const whiteEmail = playerColor === 'w' ? email : 'stockfish'
    const blackEmail = playerColor === 'b' ? email : 'stockfish'
    await recordGame({ whiteEmail, blackEmail, result, mode })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '저장 실패' })
  }
})

app.get('/api/ranking', async (req, res) => {
  try {
    const ranking = await getRanking()
    res.json({ ranking })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '랭킹 조회 실패' })
  }
})

app.get('/api/me/stats', requireAuth, async (req, res) => {
  try {
    const stats = await getUserStats(req.user.email)
    res.json(stats)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: '통계 조회 실패' })
  }
})

// ── Matchmaking queue ─────────────────────────────────────────────────────────

const matchQueue = []

function tryMatch() {
  if (matchQueue.length < 2) return
  const p1 = matchQueue.shift()
  const p2 = matchQueue.shift()
  const { roomId, creatorColor } = createRoom(p1.socketId, p1.email, 'random')
  joinRoom(roomId, p2.socketId, p2.email)
  const p2Color = creatorColor === 'w' ? 'b' : 'w'
  const s1 = io.sockets.sockets.get(p1.socketId)
  const s2 = io.sockets.sockets.get(p2.socketId)
  if (s1) { s1.join(roomId); s1.emit('match:found', { roomId, color: creatorColor }) }
  if (s2) { s2.join(roomId); s2.emit('match:found', { roomId, color: p2Color }) }
}

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('connected:', socket.id)

  socket.on('room:create', ({ token, preferredColor = 'random' } = {}) => {
    const payload = verifyToken(token)
    const { roomId, creatorColor } = createRoom(socket.id, payload?.email ?? null, preferredColor)
    socket.join(roomId)
    socket.emit('room:created', { roomId, color: creatorColor })
  })

  socket.on('room:join', ({ roomId, token }) => {
    const payload = verifyToken(token)
    const result = joinRoom(roomId, socket.id, payload?.email ?? null)
    if (result.error) {
      socket.emit('room:error', { message: result.error })
      return
    }
    socket.join(roomId)
    socket.emit('room:joined', { color: result.color, fen: result.room.game.fen(), roomId })
    socket.to(roomId).emit('room:opponentJoined', { color: result.color })
  })

  socket.on('match:enqueue', ({ token } = {}) => {
    const payload = verifyToken(token)
    if (!payload?.email) {
      socket.emit('match:error', { message: '로그인이 필요합니다' })
      return
    }
    const existing = matchQueue.findIndex(p => p.socketId === socket.id)
    if (existing !== -1) matchQueue.splice(existing, 1)
    matchQueue.push({ socketId: socket.id, email: payload.email })
    socket.emit('match:queued', { position: matchQueue.length })
    tryMatch()
  })

  socket.on('match:cancel', () => {
    const idx = matchQueue.findIndex(p => p.socketId === socket.id)
    if (idx !== -1) matchQueue.splice(idx, 1)
    socket.emit('match:cancelled')
  })

  socket.on('game:move', ({ roomId, from, to, promotion }) => {
    const result = applyMove(roomId, socket.id, { from, to, promotion: promotion || 'q' })
    if (result.error) {
      socket.emit('room:error', { message: result.error })
      return
    }
    socket.to(roomId).emit('game:move', { from, to, promotion, fen: result.fen })

    if (result.gameOver) {
      const { result: gameResult, players } = result.gameOver
      io.to(roomId).emit('game:over', { result: gameResult })
      if (players.w.email && players.b.email) {
        recordGame({
          whiteEmail: players.w.email,
          blackEmail: players.b.email,
          result: gameResult,
          mode: 'online',
        }).catch(err => console.error('game record failed:', err))
      }
    }
  })

  socket.on('game:reset', ({ roomId }) => {
    const fen = resetRoom(roomId)
    if (fen) {
      io.to(roomId).emit('game:reset', { fen })
    }
  })

  socket.on('variant:create', ({ token, variantId, preferredColor = 'random' } = {}) => {
    const payload = verifyToken(token)
    const startFen = variantId === 'chess960' ? generateChess960Fen() : VARIANT_START_FENS[variantId]
    if (!startFen) { socket.emit('variant:error', { message: '알 수 없는 변형입니다' }); return }
    const roomResult = createVariantRoom(socket.id, variantId, startFen, payload?.email ?? null, preferredColor)
    if (roomResult.error) { socket.emit('variant:error', { message: roomResult.error }); return }
    const { roomId, creatorColor } = roomResult
    socket.join(roomId)
    socket.emit('variant:created', { roomId, color: creatorColor, startFen })
  })

  socket.on('variant:join', ({ roomId, variantId, token }) => {
    const payload = verifyToken(token)
    const result = joinVariantRoom(roomId, socket.id, payload?.email ?? null)
    if (result.error) { socket.emit('variant:error', { message: result.error }); return }
    socket.join(roomId)
    socket.emit('variant:joined', { color: result.color, roomId, startFen: result.room.startFen })
    socket.to(roomId).emit('variant:opponentJoined', { color: result.color })
  })

  socket.on('variant:move', ({ roomId, from, to, promotion }) => {
    const result = applyVariantMove(roomId, socket.id, { from, to, promotion })
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

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id)
    const qIdx = matchQueue.findIndex(p => p.socketId === socket.id)
    if (qIdx !== -1) matchQueue.splice(qIdx, 1)
    const room = removePlayer(socket.id)
    if (room) {
      io.to(room.id).emit('room:opponentLeft')
    }
    const variantRoom = removeVariantPlayer(socket.id)
    if (variantRoom) {
      io.to(variantRoom.id).emit('variant:opponentLeft')
    }
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`))
