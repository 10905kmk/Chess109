# 게임 모드

## 1. 로컬 대전 (`LocalGamePage`)

한 화면에서 두 명이 번갈아 두는 모드입니다. 로그인 없이도 플레이 가능합니다.

**특징:**
- 서버/네트워크 통신 없음 (완전히 클라이언트 측)
- `useChessGame` 훅으로 게임 상태 관리
- 게임 결과가 DB에 기록되지 않음
- 이동 기록과 잡힌 기물 표시

**흐름:**
1. 로비에서 "로컬 대전" 선택
2. 백이 먼저 이동 → 흑 이동 반복
3. 체크메이트/스테일메이트/무승부 시 결과 표시
4. 다시 시작 가능

---

## 2. AI 대전 (`AiGamePage`)

Stockfish 엔진을 상대로 플레이하는 모드입니다.

**특징:**
- Stockfish 16 (WASM) 사용 — Web Worker로 분리 실행
- 난이도 5단계 선택 가능
- 기물 색 선택 가능 (백/흑)
- 게임 결과 DB 저장 (로그인 필요)

### 난이도 설정

| 난이도 | 탐색 깊이(Depth) | 스킬 레벨 |
|--------|-----------------|-----------|
| 입문   | 5               | 0         |
| 초급   | 8               | 5         |
| 중급   | 12              | 10        |
| 고급   | 18              | 15        |
| 전문가 | 22              | 20        |

- **Depth**: 엔진이 몇 수 앞까지 계산할지 (높을수록 강함)
- **Skill Level**: 0~20, 의도적인 실수 비율 조절 (낮을수록 실수를 더 많이 함)

### 게임 흐름

```
설정 화면
  ├── 난이도 선택
  └── 기물 색 선택 (백/흑)
        │
        ▼
게임 시작
  │
  ├── 플레이어 턴: 체스판 클릭으로 이동
  │
  └── AI 턴:
        1. 현재 FEN을 Stockfish Worker에 전달
        2. "AI가 생각 중..." 표시 (isThinking: true)
        3. Worker가 bestmove 반환
        4. 이동 적용 후 플레이어 턴으로
        │
        ▼
게임 종료 (체크메이트 / 스테일메이트 / 무승부)
  └── POST /api/game/result 로 결과 저장
```

### 결과 기록

```javascript
POST /api/game/result
{
  result: 'white' | 'black' | 'draw',
  playerColor: 'w' | 'b',
  mode: 'ai'
}
```
서버는 AI의 이메일을 `"stockfish"`로 채워 `game_results`에 저장합니다.

---

## 3. 친선전 (`OnlineGamePage`)

방 코드로 친구를 초대해 실시간 대전하는 모드입니다.

**특징:**
- Socket.io를 통한 실시간 통신
- 룸 코드 방식으로 친구와 연결
- **방 만들기 전 기물 색상 선택 가능** (백 / 랜덤 / 흑)
- 게임 결과 DB 저장 (로그인 사용자만, 게스트 제외)
- 서버에서 이동 유효성 재검증

### 색상 선택

방을 만들기 전에 원하는 기물 색을 선택합니다:

| 선택 | 동작 |
|------|------|
| ♔ 백 | 방장이 백, 참가자가 흑 |
| 🎲 랜덤 | 서버가 무작위로 배정 |
| ♚ 흑 | 방장이 흑, 참가자가 백 |

`preferredColor` 값이 `room:create` 이벤트에 포함되어 서버의 `createRoom()`으로 전달됩니다.

### 친선전 단계

```
[Lobby 단계]
  ├── "방 만들기" 선택
  │     → 색상 피커 표시 (♔ 백 / 🎲 랜덤 / ♚ 흑)
  │     → room:create 이벤트 전송 { token, preferredColor }
  │     → room:created 수신 (roomId, playerColor)
  │     → [Waiting 단계] 진입
  │
  └── "방 입장" 선택 (또는 공유 링크)
        → 룸 코드 입력
        → room:join 이벤트 전송
        → room:joined 수신 (color, initialFen)
        → [Playing 단계] 진입

[Waiting 단계] (방장만)
  - 룸 코드와 입장 링크 표시
  - room:opponentJoined 수신 시 → [Playing 단계] 진입

[Playing 단계]
  - 체스판 활성화
  - 이동 → game:move 이벤트 송수신
  - 상대 연결 끊김 → room:opponentLeft 수신
  - 게임 종료 → 결과 저장 후 표시
```

### 룸 코드

- 4~6자리 알파벳+숫자 조합 (대문자)
- `I`, `O`, `L`, `0` 제외 (혼동 방지)
- 예: `AB3K`, `XP9QR`

### 이중 이동 검증

보안을 위해 클라이언트와 서버 양쪽에서 이동을 검증합니다:
1. **클라이언트**: chess.js가 이동 합법성 검사 후 emit
2. **서버**: `gameManager.applyMove()`에서 다시 chess.js로 재검증

부정 이동은 서버에서 거부되고 `room:error` 이벤트로 알립니다.

---

## 4. 자동 매칭 (`MatchPage`)

로그인 사용자끼리 자동으로 연결해주는 모드입니다. **로그인 필수 (게스트 불가)**.

**특징:**
- 별도 페이지 이동 없이 대기 → 게임이 한 페이지에서 처리
- Socket.io로 매칭 큐 관리
- 게임 결과 자동 DB 저장 (친선전과 동일)

### 매칭 단계

```
[idle 단계]
  - "대전 시작" 버튼 표시

  클릭 시
  → match:enqueue { token } 전송
  → match:queued 수신

[queuing 단계]
  - "상대 탐색 중..." 애니메이션 표시
  - "취소" 버튼 클릭 시 match:cancel 전송 → idle 복귀

  match:found 수신 시 { roomId, color }
  → socket.join(roomId) 자동 처리 (서버 측)

[playing 단계]
  - 체스판 활성화 (친선전과 동일 UI)
  - 이동 → game:move 이벤트 송수신
  - 게임 종료 → DB 저장 → 결과 표시
  - 다시 매칭 버튼 → idle 복귀
```

### 서버 매칭 로직

서버는 `matchQueue` 배열로 대기 플레이어를 관리합니다:

```javascript
// matchQueue 항목
{ socketId: 'abc123', email: 'player@school.com' }

// tryMatch(): 큐에 2명 이상이면 자동으로 쌍을 만들어 게임 시작
function tryMatch() {
  if (matchQueue.length < 2) return;
  const [p1, p2] = matchQueue.splice(0, 2);
  const { roomId, creatorColor } = createRoom(p1.socketId, p1.email, 'random');
  joinRoom(roomId, p2.socketId, p2.email);
  // 각 플레이어에게 match:found 전송
}
```

- 큐는 FIFO 방식으로 앞에서 2명씩 꺼냄
- 색상은 항상 랜덤 배정 (매칭에서는 색상 선택 없음)
