# Chess109

학교 학생들을 위한 체스 웹 애플리케이션. SuperSchool 계정으로 로그인하거나 게스트로 입장해 4가지 게임 모드를 즐길 수 있습니다.

## 기술 스택

**클라이언트** — React 18 + Vite, chess.js, react-chessboard, Stockfish 16 (WASM), Socket.io-client  
**서버** — Node.js + Express, Socket.io, Prisma ORM  
**DB** — PostgreSQL (개발: Docker, 프로덕션: Supabase)

## 게임 모드

| 모드 | 경로 | 로그인 |
|------|------|--------|
| 로컬 대전 | `/local` | 불필요 |
| AI 대전 (Stockfish) | `/ai` | 선택 (결과 저장 시 필요) |
| 친선전 (방 코드) | `/online` | 선택 |
| 자동 매칭 | `/match` | **필수** |

## 빠른 시작

```bash
# 의존성 설치
npm install

# DB 시작 (Docker)
docker-compose up -d

# 마이그레이션
cd server && npx prisma migrate dev

# 개발 서버 실행 (루트에서)
npm run dev
```

- 클라이언트: http://localhost:5173
- 서버: http://localhost:3001

## 프로젝트 구조

```
Chess109/
├── client/          # React + Vite 프론트엔드
│   └── src/
│       ├── hooks/   # useAuth, useChessGame, useStockfish
│       ├── pages/   # LoginPage, LobbyPage, LocalGamePage, AiGamePage,
│       │            #   OnlineGamePage, MatchPage, MyPage, RankingPage
│       └── components/  # ChessBoardWrapper, GameStatus, MoveHistory
└── server/          # Express + Socket.io 백엔드
    └── src/
        ├── index.js       # 라우트 + 소켓 이벤트
        ├── gameManager.js # 인메모리 게임 룸 관리
        ├── db.js          # Prisma DB 작업
        └── superschool.js # 학교 인증 프록시
```

## 인증 흐름

1. SuperSchool API로 학교 계정 인증 (서버 프록시)
2. 서버가 Chess109 JWT 발급 (7일 만료)
3. 클라이언트가 `localStorage`에 저장
4. 게스트 모드: JWT 없이 `{ name: '게스트', isGuest: true }` 상태로 제한적 사용

## 상세 문서

| 문서 | 내용 |
|------|------|
| [아키텍처](./docs/02-architecture.md) | 시스템 구조도, 컴포넌트 계층, 설계 결정 |
| [인증 흐름](./docs/03-auth.md) | SuperSchool OAuth, JWT, 게스트 모드 |
| [REST API](./docs/04-api.md) | 엔드포인트 명세 |
| [WebSocket 이벤트](./docs/05-websocket.md) | Socket.io 이벤트 목록, 매칭 흐름 |
| [데이터베이스](./docs/06-database.md) | 스키마, 주요 쿼리 |
| [게임 모드](./docs/07-game-modes.md) | 각 모드 상세 흐름 |
| [프론트엔드](./docs/08-frontend.md) | 훅, 컴포넌트, 페이지 상태 |
| [백엔드](./docs/09-backend.md) | 서버 파일별 역할, 소켓 핸들러 |
