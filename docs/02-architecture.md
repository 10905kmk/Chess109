# 시스템 아키텍처

## 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  React App (Vite)                     │  │
│  │                                                       │  │
│  │  App.jsx (Router)                                     │  │
│  │  ├── AuthProvider (useAuth context)                   │  │
│  │  ├── LoginPage                                        │  │
│  │  ├── LobbyPage                                        │  │
│  │  ├── LocalGamePage ──── useChessGame                  │  │
│  │  ├── AiGamePage ──────── useChessGame + useStockfish  │  │
│  │  ├── OnlineGamePage ─── useChessGame + socket.io      │  │
│  │  ├── MyPage                                           │  │
│  │  └── RankingPage                                      │  │
│  │                                                       │  │
│  │  Stockfish (Web Worker) ─── WASM 엔진                  │  │
│  └──────────────────────────────────────────────────────┘  │
│           │ HTTP REST                │ WebSocket            │
└───────────┼──────────────────────────┼─────────────────────┘
            │                          │
┌───────────▼──────────────────────────▼─────────────────────┐
│                   Node.js / Express Server                   │
│                                                             │
│  index.js (라우트 + Socket.io 이벤트 핸들러)                  │
│  ├── /auth/login         → superschool.js                   │
│  ├── /auth/me            → JWT 검증                          │
│  ├── /api/game/result    → db.js (게임 결과 저장)             │
│  ├── /api/me/stats       → db.js (내 전적 조회)              │
│  └── /api/ranking        → db.js (랭킹 조회)                 │
│                                                             │
│  gameManager.js (인메모리 게임 룸 관리)                       │
│  superschool.js (SuperSchool API 프록시)                     │
│  db.js (Prisma ORM 래퍼)                                     │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ Prisma ORM
┌──────────────────────────▼──────────────────────────────────┐
│                      PostgreSQL                              │
│                                                             │
│  users          game_results                                 │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────▼──────────────────┐
           │       SuperSchool API             │
           │  (외부 학교 인증 서비스)            │
           └──────────────────────────────────┘
```

## 컴포넌트 계층 구조

```
App
└── BrowserRouter
    └── AuthProvider
        ├── LoginPage
        │
        ├── RequireAuth (인증 필요 래퍼)
        │   ├── LobbyPage
        │   │
        │   ├── LocalGamePage
        │   │   ├── useChessGame (훅)
        │   │   ├── ChessBoardWrapper
        │   │   ├── GameStatus
        │   │   └── MoveHistory
        │   │
        │   ├── AiGamePage
        │   │   ├── useAuth (훅)
        │   │   ├── useChessGame (훅)
        │   │   ├── useStockfish (훅)
        │   │   ├── ChessBoardWrapper
        │   │   ├── GameStatus
        │   │   └── MoveHistory
        │   │
        │   ├── OnlineGamePage
        │   │   ├── useAuth (훅)
        │   │   ├── useChessGame (훅)
        │   │   ├── socket (Socket.io 인스턴스)
        │   │   ├── ChessBoardWrapper
        │   │   ├── GameStatus
        │   │   └── MoveHistory
        │   │
        │   ├── MyPage
        │   │   └── useAuth (훅)
        │   │
        │   └── RankingPage
```

## Vite 프록시 설정

개발 환경에서 클라이언트는 Vite의 프록시를 통해 백엔드와 통신합니다.
`vite.config.js`에서 `http://localhost:3001`으로 프록시:

| 경로 | 설명 |
|------|------|
| `/socket.io` | WebSocket 프록시 (ws:// 업그레이드 포함) |
| `/api` | REST API |
| `/auth` | 인증 엔드포인트 |
| `/health` | 서버 상태 확인 |

프로덕션 환경에서는 `VITE_SERVER_URL` 환경변수로 서버 주소를 직접 지정합니다.

## 주요 아키텍처 결정 사항

### 인메모리 게임 룸
온라인 게임의 룸 상태는 DB가 아닌 서버 메모리(`gameManager.js`의 `Map`)에 저장합니다.
실시간 체스 게임은 매 수마다 DB 접근이 불필요하고 속도가 중요하기 때문입니다.
대신 게임이 끝나면 최종 결과만 DB에 저장합니다.

### Web Worker로 Stockfish 분리
Stockfish AI 엔진은 별도의 Web Worker 스레드에서 실행됩니다.
AI가 수를 계산하는 동안 UI가 멈추지 않게 하기 위한 결정입니다.

### useRef로 게임 상태 관리
`useChessGame` 훅은 chess.js 인스턴스를 `useState`가 아닌 `useRef`로 관리합니다.
Socket.io 이벤트 리스너나 콜백 내부에서 항상 최신 게임 상태를 참조하기 위한 패턴입니다
(클로저 stale 문제 방지).

### SuperSchool 프록시
클라이언트가 SuperSchool API를 직접 호출하지 않고 서버를 거칩니다.
CORS 문제를 피하고 학교 인증 자격증명이 브라우저에 노출되지 않도록 하기 위함입니다.
