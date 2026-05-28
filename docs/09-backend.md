# 백엔드 상세

## 서버 구조

```
server/src/
├── index.js          # 진입점: Express 설정, 라우트, Socket.io 이벤트
├── db.js             # 데이터베이스 작업 (Prisma 래퍼)
├── gameManager.js    # 인메모리 게임 룸 관리
└── superschool.js    # SuperSchool API 클라이언트
```

---

## `index.js` — 서버 진입점

Express 앱과 Socket.io 서버를 초기화하고 모든 라우트를 등록합니다.

**초기화 순서:**
1. `express()` 앱 생성
2. `http.createServer(app)`으로 HTTP 서버 생성
3. `new Server(httpServer, { cors: ... })`로 Socket.io 서버 연결
4. 미들웨어 등록 (CORS, JSON 파싱)
5. 라우트 등록
6. Socket.io 이벤트 핸들러 등록
7. `httpServer.listen(PORT)` 시작

**CORS 설정:**
- `CLIENT_URL` 환경변수(기본값: `http://localhost:5173`)에서 온 요청만 허용

---

## `gameManager.js` — 게임 룸 관리

온라인 게임의 룸 상태를 메모리에서 관리합니다.

### 주요 메서드

#### `createRoom(socketId, email, preferredColor?)`
새 룸을 생성하고 룸 정보를 반환합니다.

```javascript
const { roomId, creatorColor } = gameManager.createRoom(socket.id, email, 'w');
// preferredColor: 'w' | 'b' | 'random' (기본값: 'random')
// creatorColor: 실제 배정된 색상 ('w' | 'b')
```

색상 배정 로직:
- `'w'` → 방장이 백
- `'b'` → 방장이 흑
- `'random'` → 50% 확률로 무작위 배정

#### `joinRoom(roomId, socketId, email, name)`
룸에 두 번째 플레이어를 추가합니다.

```javascript
const result = gameManager.joinRoom(roomId, socket.id, email, name);
// 반환: { success: true, color: 'b', fen: '...' }
// 또는: { success: false, error: '존재하지 않는 룸' }
```

#### `applyMove(roomId, socketId, from, to, promotion)`
이동을 검증하고 룸의 게임 상태에 적용합니다.

```javascript
const result = gameManager.applyMove(roomId, socket.id, 'e2', 'e4');
// 반환: { success: true, move: {...}, isGameOver: false, result: null }
// 이동 불가 시: { success: false, error: '...' }
```

#### `getPlayerEmails(roomId)`
룸의 두 플레이어 이메일을 반환합니다.

```javascript
const { whiteEmail, blackEmail } = gameManager.getPlayerEmails(roomId);
```

#### `cleanupRooms()`
2시간이 지난 룸을 삭제합니다. 30분마다 자동 호출됩니다.

---

## `superschool.js` — SuperSchool API 클라이언트

SuperSchool 인증 API를 호출하는 함수들입니다.

### `authenticateWithSuperSchool(loginId, password)`

```javascript
const userInfo = await authenticateWithSuperSchool(loginId, password);
// 반환: { email, name, studentId, grade, klass, school }
// 실패 시: throw Error
```

**내부 동작:**
1. `POST https://front.superschool.link/api-v2/auth/school-login` → SS 액세스 토큰 획득
2. `GET https://web.superschool.link/api/users/me` → 사용자 정보 조회
3. `POST .../auth/logout` → SS 토큰 즉시 폐기
4. 필요한 정보만 추출해 반환

---

## `db.js` — 데이터베이스 작업

Prisma 클라이언트를 초기화하고 모든 DB 작업 함수를 export합니다.

| 함수 | 설명 |
|------|------|
| `upsertUser(userInfo)` | 로그인 시 사용자 생성 또는 `last_login` 업데이트 |
| `saveGameResult(data)` | 게임 결과 저장 |
| `getUserStats(email)` | 사용자 전체 전적 집계 |
| `getRanking()` | 온라인 게임 상위 50명 랭킹 조회 |

---

## Socket.io 이벤트 핸들러 (`index.js` 내)

```javascript
// 매칭 큐 (인메모리 배열)
const matchQueue = [];  // [{ socketId, email }, ...]

function tryMatch() {
  if (matchQueue.length < 2) return;
  const [p1, p2] = matchQueue.splice(0, 2);
  const { roomId, creatorColor } = gameManager.createRoom(p1.socketId, p1.email, 'random');
  gameManager.joinRoom(roomId, p2.socketId, p2.email);
  const p2Color = creatorColor === 'w' ? 'b' : 'w';
  io.to(p1.socketId).emit('match:found', { roomId, color: creatorColor });
  io.to(p2.socketId).emit('match:found', { roomId, color: p2Color });
  io.sockets.sockets.get(p1.socketId)?.join(roomId);
  io.sockets.sockets.get(p2.socketId)?.join(roomId);
}

io.on('connection', (socket) => {

  // 친선전: 방 만들기
  socket.on('room:create', ({ token, preferredColor }) => {
    const email = verifyToken(token)?.email ?? null;
    const { roomId, creatorColor } = gameManager.createRoom(socket.id, email, preferredColor);
    socket.join(roomId);
    socket.emit('room:created', { roomId, playerColor: creatorColor });
  });

  // 친선전: 방 입장
  socket.on('room:join', ({ roomId, token }) => {
    const email = verifyToken(token)?.email ?? null;
    const result = gameManager.joinRoom(roomId, socket.id, email);
    if (!result.success) {
      socket.emit('room:error', { message: result.error });
      return;
    }
    socket.join(roomId);
    socket.emit('room:joined', { color: result.color, initialFen: result.fen });
    socket.to(roomId).emit('room:opponentJoined');
  });

  // 매칭: 큐 등록
  socket.on('match:enqueue', ({ token }) => {
    const payload = verifyToken(token);
    if (!payload?.email) return;  // 게스트 차단
    matchQueue.push({ socketId: socket.id, email: payload.email });
    socket.emit('match:queued');
    tryMatch();
  });

  // 매칭: 큐 이탈
  socket.on('match:cancel', () => {
    const idx = matchQueue.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) matchQueue.splice(idx, 1);
  });

  // 이동
  socket.on('game:move', ({ roomId, from, to, promotion }) => {
    const result = gameManager.applyMove(roomId, socket.id, from, to, promotion);
    if (!result.success) {
      socket.emit('room:error', { message: result.error });
      return;
    }
    socket.to(roomId).emit('game:move', { from, to, promotion });
    if (result.isGameOver) {
      const { whiteEmail, blackEmail } = gameManager.getPlayerEmails(roomId);
      db.saveGameResult({ whiteEmail, blackEmail, result: result.result, mode: 'online' });
    }
  });

  socket.on('disconnect', () => {
    // 매칭 큐에서도 제거
    const idx = matchQueue.findIndex(p => p.socketId === socket.id);
    if (idx !== -1) matchQueue.splice(idx, 1);
    // 게임 중이었으면 상대에게 알림
    const roomId = gameManager.getRoomBySocket(socket.id);
    if (roomId) socket.to(roomId).emit('room:opponentLeft');
  });

});
```

---

## 미들웨어

### `requireAuth`

JWT를 검증하고 `req.user`에 디코딩된 사용자 정보를 주입합니다.

```javascript
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
```
