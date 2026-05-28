# Chess109 프로젝트 개요

## 프로젝트 소개

Chess109는 학교 학생들이 체스를 즐길 수 있는 풀스택 웹 애플리케이션입니다.
SuperSchool 계정으로 로그인하여 로컬 대전, AI 대전, 친선전(방 코드), 자동 매칭 4가지 모드를 지원합니다.
SuperSchool 계정 없이도 게스트로 입장해 로컬 대전 · AI 대전 · 친선전을 즐길 수 있습니다.

## 기술 스택

### 프론트엔드
| 항목 | 기술 |
|------|------|
| 프레임워크 | React 18.3.1 |
| 빌드 툴 | Vite 5.4.3 |
| 라우터 | React Router 6.26.2 |
| 체스 로직 | chess.js 1.3.0 |
| 체스 UI | react-chessboard 4.7.2 |
| 실시간 통신 | Socket.io-client 4.8.1 |
| AI 엔진 | Stockfish 16.0.0 (WASM) |
| 스타일 | CSS Modules |

### 백엔드
| 항목 | 기술 |
|------|------|
| 프레임워크 | Express.js 4.21.0 |
| 실시간 통신 | Socket.io 4.8.1 |
| ORM | Prisma 5.22.0 |
| 데이터베이스 | PostgreSQL |
| 인증 | JWT (jsonwebtoken 9.0.3) |
| 외부 인증 | SuperSchool API |

## 전체 디렉토리 구조

```
Chess109/
├── package.json              # 루트 monorepo 설정
├── docs/                     # 프로젝트 문서 (이 폴더)
│
├── client/                   # 프론트엔드 (React + Vite)
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── .env.example
│   ├── public/
│   │   └── stockfish/        # Stockfish 엔진 WASM 파일
│   │       ├── stockfish-nnue-16.js
│   │       └── stockfish-nnue-16.wasm
│   └── src/
│       ├── main.jsx          # React 진입점
│       ├── App.jsx           # 라우터 설정
│       ├── index.css         # 전역 스타일
│       ├── lib/
│       │   └── socket.js     # Socket.io 클라이언트 초기화
│       ├── hooks/
│       │   ├── useAuth.jsx       # 인증 컨텍스트 & 로그인/로그아웃
│       │   ├── useChessGame.js   # 체스 게임 상태 관리
│       │   └── useStockfish.js   # Stockfish 엔진 래퍼
│       ├── components/
│       │   ├── ChessBoardWrapper.jsx  # 체스판 UI & 이동 처리
│       │   ├── GameStatus.jsx         # 게임 상태 표시
│       │   └── MoveHistory.jsx        # 이동 기록 표시
│       └── pages/
│           ├── LoginPage.jsx      # SuperSchool 로그인 + 게스트 입장
│           ├── LobbyPage.jsx      # 게임 모드 선택 (게스트 제한 포함)
│           ├── LocalGamePage.jsx  # 로컬 2인 대전
│           ├── AiGamePage.jsx     # AI 대전
│           ├── OnlineGamePage.jsx # 친선전 (방 코드, 색상 선택 포함)
│           ├── MatchPage.jsx      # 자동 매칭 대전
│           ├── MyPage.jsx         # 내 전적/통계
│           └── RankingPage.jsx    # 전체 랭킹
│
└── server/                   # 백엔드 (Node.js + Express)
    ├── package.json
    ├── .env
    ├── .env.example
    └── src/
        ├── index.js          # Express 서버 진입점, 모든 라우트
        ├── db.js             # 데이터베이스 작업 (Prisma)
        ├── gameManager.js    # 게임 룸 & 이동 유효성 검사
        └── superschool.js    # SuperSchool API 인증 연동
    └── prisma/
        ├── schema.prisma     # DB 스키마 정의
        └── migrations/       # 마이그레이션 파일들
```

## 환경 설정

### 서버 `.env`
```
PORT=3001
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://chess109:chess109@localhost:5434/chess109
JWT_SECRET=chess109-dev-secret-change-in-prod
```

### 클라이언트 `.env`
```
VITE_SERVER_URL=   # 개발 환경에서는 비워둠 (Vite 프록시 사용)
                   # 프로덕션에서는 서버 URL 입력
```

## 관련 문서

- [아키텍처](./02-architecture.md)
- [인증 흐름](./03-auth.md)
- [REST API](./04-api.md)
- [WebSocket 이벤트](./05-websocket.md)
- [데이터베이스](./06-database.md)
- [게임 모드](./07-game-modes.md)
- [프론트엔드 상세](./08-frontend.md)
- [백엔드 상세](./09-backend.md)
