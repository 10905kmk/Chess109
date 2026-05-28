# 프론트엔드 상세

## 진입점과 라우팅

**`client/src/main.jsx`**
React 앱의 최상위 진입점. `AuthProvider`로 전체 앱을 감쌉니다.

**`client/src/App.jsx`**
React Router로 페이지를 라우팅합니다.

| 경로 | 컴포넌트 | 가드 |
|------|----------|------|
| `/` | `LoginPage` | 없음 |
| `/lobby` | `LobbyPage` | `RequireAuth` |
| `/local` | `LocalGamePage` | 없음 |
| `/ai` | `AiGamePage` | `RequireAuth` |
| `/online` | `OnlineGamePage` | `RequireAuth` |
| `/match` | `MatchPage` | `RequireFullAuth` |
| `/me` | `MyPage` | `RequireFullAuth` |
| `/ranking` | `RankingPage` | `RequireFullAuth` |

**라우팅 가드 종류:**
- `RequireAuth`: `user === null`이면 `/`로 리다이렉트. 게스트(`isGuest: true`)는 통과.
- `RequireFullAuth`: `user === null` 또는 `user.isGuest === true`이면 `/`로 리다이렉트.

---

## 커스텀 훅

### `useAuth` (`hooks/useAuth.jsx`)

인증 상태를 전역으로 관리하는 Context + Provider 패턴입니다.

```javascript
const { user, loading, login, loginAsGuest, logout, getToken } = useAuth();
```

| 값 | 타입 | 설명 |
|----|------|------|
| `user` | `object \| null` | 현재 유저 (null이면 완전 미로그인) |
| `loading` | `boolean` | 초기 토큰 검증 중 여부 |
| `login(loginId, password)` | `async function` | SuperSchool 로그인 |
| `loginAsGuest()` | `function` | 게스트 로그인 — `{ name: '게스트', isGuest: true }` 설정 |
| `logout()` | `function` | 로그아웃 (토큰 삭제 + user → null) |
| `getToken()` | `function` | 저장된 JWT 반환 (게스트는 null) |

앱 마운트 시 localStorage의 `chess109_token`으로 `/auth/me`를 호출해 세션을 복원합니다.
게스트 상태는 `user.isGuest === true`로 구분합니다.

---

### `useChessGame` (`hooks/useChessGame.js`)

chess.js를 래핑한 게임 상태 관리 훅입니다.

```javascript
const {
  fen, turn, isCheck, isCheckmate, isDraw,
  moveHistory, capturedPieces,
  makeMove, loadFen, reset, getLegalMoves
} = useChessGame();
```

| 값 | 타입 | 설명 |
|----|------|------|
| `fen` | `string` | 현재 보드 FEN 문자열 |
| `turn` | `'w' \| 'b'` | 현재 차례 |
| `isCheck` | `boolean` | 체크 상태 |
| `isCheckmate` | `boolean` | 체크메이트 상태 |
| `isDraw` | `boolean` | 무승부 상태 |
| `moveHistory` | `array` | 이동 기록 배열 |
| `capturedPieces` | `object` | 잡힌 기물 목록 |
| `makeMove(from, to, promotion?)` | `function` | 이동 시도, 성공 여부 반환 |
| `loadFen(fen)` | `function` | FEN으로 보드 상태 로드 |
| `reset()` | `function` | 초기 상태로 리셋 |
| `getLegalMoves(square)` | `function` | 특정 칸의 합법 이동 목록 반환 |

> chess.js 인스턴스를 `useRef`로 관리해 Socket.io 콜백의 stale closure 문제를 방지합니다.

---

### `useStockfish` (`hooks/useStockfish.js`)

Stockfish WASM 엔진을 Web Worker로 실행하는 훅입니다.

```javascript
const { getBestMove, isReady } = useStockfish({ depth, skillLevel });
```

| 파라미터 | 설명 |
|----------|------|
| `depth` | 탐색 깊이 (5~22) |
| `skillLevel` | 스킬 레벨 (0~20) |

```javascript
const bestMove = await getBestMove(fen);
// 반환값: { from: 'e2', to: 'e4', promotion: null }
```

**UCI 통신 순서:**
1. Worker 초기화 → `uci` 명령 전송
2. `setoption name Skill Level value <n>` 전송
3. `position fen <fen>` 전송
4. `go depth <n>` 전송
5. `bestmove` 응답 파싱

---

## 컴포넌트

### `ChessBoardWrapper` (`components/ChessBoardWrapper.jsx`)

react-chessboard를 래핑한 체스판 UI 컴포넌트입니다.

**Props:**

| Prop | 설명 |
|------|------|
| `fen` | 현재 보드 FEN |
| `playerColor` | 보드 방향 (`'w'` \| `'b'`) |
| `onMove(from, to, promotion?)` | 이동 콜백 |
| `disabled` | 이동 비활성화 여부 |
| `highlightedSquares` | 하이라이트할 칸 목록 |

**기능:**
- 클릭 방식: 출발 칸 선택 → 도착 칸 선택
- 드래그 방식도 지원
- 폰 프로모션 UI (퀸/룩/비숍/나이트 선택)
- 합법 이동 칸 하이라이트

---

### `GameStatus` (`components/GameStatus.jsx`)

현재 게임 상태를 표시합니다.

- 현재 턴 (백/흑)
- 체크 경고
- 체크메이트 / 스테일메이트 / 무승부 알림

---

### `MoveHistory` (`components/MoveHistory.jsx`)

이동 기록을 체스 표기법(대수 기보법)으로 표시합니다.

- `1. e4 e5 2. Nf3 Nc6 ...` 형태
- 잡힌 기물 표시

---

## 페이지별 상태 요약

### `LoginPage`
- 상태: `loginId`, `password`, `error`, `loading`
- 제출 시 `useAuth.login()` 호출
- "게스트로 입장" 버튼: `loginAsGuest()` 호출 후 `/lobby`로 이동

### `LobbyPage`
- `requiresAuth: true`인 카드(매칭)는 게스트에게 비활성화 표시
- 게스트는 `/me`, `/ranking` 링크 숨김
- 4가지 게임 모드 카드 (로컬, AI, 친선전, 자동매칭)

### `AiGamePage`
- 상태: `difficulty`, `playerColor`, `gameStarted`, `isThinking`
- 게임 종료 시 `useEffect`로 결과 저장 (게스트면 토큰 없어 스킵됨)

### `OnlineGamePage` (친선전)
- 상태: `phase` (`lobby` | `waiting` | `playing`), `roomId`, `playerColor`, `opponentConnected`, `colorPref`
- `colorPref`: `'w' | 'random' | 'b'` (방 만들기 전 색상 선택)
- Socket.io 이벤트 리스너는 `useEffect`로 등록/해제

### `MatchPage` (자동 매칭)
- 상태: `phase` (`idle` | `queuing` | `playing`), `roomId`, `playerColor`, `opponentConnected`
- `handleStart()`: `match:enqueue { token }` 전송
- `handleCancel()`: `match:cancel` 전송 → `idle`로 복귀
- `match:found` 수신 시 `phase → 'playing'` (페이지 이동 없음)
- 게임 UI는 `OnlineGamePage`와 동일 구조

### `MyPage`
- 상태: `stats`, `loading`, `error`
- 마운트 시 `/api/me/stats` 호출

### `RankingPage`
- 상태: `ranking`, `loading`, `error`
- 마운트 시 `/api/ranking` 호출
