# WebSocket 통신 (Socket.io)

## 개요

온라인 게임은 Socket.io를 사용한 양방향 실시간 통신으로 구현됩니다.
서버는 Socket.io 룸(room) 기능을 활용해 같은 게임의 두 플레이어 간에만 이벤트를 전달합니다.

## 연결

**클라이언트 (`client/src/lib/socket.js`):**
```javascript
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';
export const socket = io(SERVER_URL, { autoConnect: false });
```

- `autoConnect: false`로 설정하여 게임 페이지 진입 시에만 연결합니다.
- `OnlineGamePage`와 `MatchPage`에서 `socket.connect()` / `socket.disconnect()`를 명시적으로 호출합니다.

---

## 이벤트 목록

### 클라이언트 → 서버

#### `room:create`
새로운 친선전 룸을 생성합니다.

```javascript
socket.emit('room:create', {
  token: 'JWT...',            // 인증 토큰 (게스트는 null)
  preferredColor: 'w',        // 원하는 기물 색: 'w' | 'b' | 'random'
});
```

#### `room:join`
기존 게임 룸에 입장합니다.

```javascript
socket.emit('room:join', {
  roomId: 'AB3K',            // 룸 코드
  email: 'user@school.com',
  name: '홍길동'
});
```

#### `game:move`
체스 이동을 상대방에게 전달합니다.

```javascript
socket.emit('game:move', {
  roomId: 'AB3K',
  from: 'e2',
  to: 'e4',
  promotion: 'q'  // 폰 프로모션 시에만 포함 (선택)
});
```

#### `game:reset`
게임을 초기 상태로 리셋합니다.

```javascript
socket.emit('game:reset', { roomId: 'AB3K' });
```

---

### 서버 → 클라이언트

#### `room:created`
룸 생성 성공. 방장에게만 전송됩니다.

```javascript
socket.on('room:created', ({ roomId, playerColor }) => {
  // roomId: 'AB3K'  (공유할 룸 코드)
  // playerColor: 'w' | 'b'  (preferredColor 또는 랜덤 배정 결과)
});
```

#### `room:joined`
룸 입장 성공. 입장한 플레이어에게만 전송됩니다.

```javascript
socket.on('room:joined', ({ color, initialFen }) => {
  // color: 'b'  (입장한 플레이어는 흑)
  // initialFen: 체스 초기 FEN 문자열
});
```

#### `room:opponentJoined`
상대방이 입장했음을 알립니다. 기존 방장에게 전송됩니다.

```javascript
socket.on('room:opponentJoined', ({ name }) => {
  // name: '상대 이름'
});
```

#### `room:opponentLeft`
상대방이 연결을 끊었음을 알립니다.

```javascript
socket.on('room:opponentLeft', () => {
  // 상대가 나갔음을 UI에 표시
});
```

#### `game:move`
상대방의 이동을 수신합니다.

```javascript
socket.on('game:move', ({ from, to, promotion }) => {
  // from: 'e7', to: 'e5', promotion: null
});
```

#### `game:reset`
상대방이 게임을 리셋했음을 알립니다.

```javascript
socket.on('game:reset', () => {
  // 보드를 초기 상태로 리셋
});
```

#### `room:error`
룸 관련 오류 메시지입니다.

```javascript
socket.on('room:error', ({ message }) => {
  // message: '존재하지 않는 룸입니다' | '이미 꽉 찬 룸입니다' | ...
});
```

---

## 매칭 이벤트 (MatchPage 전용)

### 클라이언트 → 서버

#### `match:enqueue`
매칭 큐에 등록합니다. 로그인 사용자만 가능 (JWT 필요).

```javascript
socket.emit('match:enqueue', { token: 'JWT...' });
```

#### `match:cancel`
매칭 큐에서 이탈합니다.

```javascript
socket.emit('match:cancel');
```

### 서버 → 클라이언트

#### `match:queued`
큐 등록 완료를 알립니다. 상대를 기다리는 중임을 표시합니다.

```javascript
socket.on('match:queued', () => {
  // "상대 탐색 중..." UI 표시
});
```

#### `match:found`
매칭 성공. 룸 정보와 색상을 전달합니다.

```javascript
socket.on('match:found', ({ roomId, color }) => {
  // roomId: 'XP9QR'
  // color: 'w' | 'b'  (서버가 랜덤 배정)
  // → 게임 UI로 전환 (페이지 이동 없음, phase 상태 변경)
});
```

---

## 온라인 게임 이동 흐름

```
플레이어 A                    서버                    플레이어 B
(백, white)                                          (흑, black)
    │                          │                          │
    │  체스판 클릭               │                          │
    │  chess.js로 이동 검증      │                          │
    │  로컬 보드 업데이트         │                          │
    │                          │                          │
    │  emit('game:move',        │                          │
    │   {roomId, from, to})     │                          │
    ├─────────────────────────►│                          │
    │                          │  gameManager.applyMove() │
    │                          │  - 이동 검증               │
    │                          │  - 게임 상태 업데이트       │
    │                          │  - 게임오버 확인            │
    │                          │                          │
    │                          │  emit('game:move',        │
    │                          │   {from, to})             │
    │                          ├─────────────────────────►│
    │                          │                          │  chess.js로
    │                          │                          │  이동 적용
    │                          │                          │  보드 업데이트
```

---

## 룸 관리

게임 룸은 `server/src/gameManager.js`에서 인메모리 Map으로 관리됩니다.

**룸 구조:**
```javascript
{
  id: 'AB3K',
  players: {
    w: { socketId: 'abc123', email: 'white@school.com' },
    b: { socketId: 'def456', email: 'black@school.com' }
  },
  game: Chess,          // chess.js 인스턴스
  createdAt: Date,
  finished: false
}
```

**룸 코드 생성:**
- 4~6자리 알파벳+숫자 조합
- 혼동하기 쉬운 문자 제외: `I`, `O`, `L`, `0`

**자동 정리:**
- 생성 후 2시간이 지난 룸은 30분마다 실행되는 인터벌로 자동 삭제됩니다.
- 메모리 누수 방지 목적입니다.
