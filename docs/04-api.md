# REST API

## 기본 정보

- **Base URL (개발)**: `http://localhost:3001`
- **Base URL (클라이언트에서)**: `/` (Vite 프록시를 통해 자동으로 `localhost:3001`으로 전달)
- **인증 방식**: `Authorization: Bearer <JWT_TOKEN>` 헤더

---

## 인증

### POST `/auth/login`

SuperSchool 계정으로 로그인합니다.

**요청 Body:**
```json
{
  "loginId": "student@school.com",
  "password": "password123"
}
```

**응답 (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "email": "student@school.com",
    "name": "홍길동",
    "studentId": "20250001",
    "grade": 1,
    "klass": 3,
    "school": "○○중학교"
  }
}
```

**오류:**
- `400` - loginId 또는 password 누락
- `401` - SuperSchool 인증 실패 (잘못된 계정 정보)
- `500` - 서버 오류

---

### GET `/auth/me`

저장된 JWT 토큰이 유효한지 확인하고 현재 사용자 정보를 반환합니다.

**헤더:** `Authorization: Bearer <token>` 필요

**응답 (200 OK):**
```json
{
  "user": {
    "email": "student@school.com",
    "name": "홍길동",
    "grade": 1,
    "klass": 3,
    "school": "○○중학교"
  }
}
```

**오류:**
- `401` - 토큰 없음 또는 유효하지 않은 토큰

---

## 게임

### POST `/api/game/result`

게임 결과를 데이터베이스에 저장합니다.

**헤더:** `Authorization: Bearer <token>` 필요 (requireAuth)

**요청 Body:**
```json
{
  "result": "white",
  "playerColor": "w",
  "mode": "ai"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `result` | `"white" \| "black" \| "draw"` | 게임 결과 (어느 색이 이겼는지) |
| `playerColor` | `"w" \| "b"` | 요청한 사용자의 기물 색 |
| `mode` | `"ai" \| "online"` | 게임 모드 |

**응답 (200 OK):**
```json
{ "ok": true }
```

**동작:**
- `mode: "ai"` 일 때: AI의 이메일은 `"stockfish"`로 기록됩니다.
- `mode: "online"` 일 때: 두 플레이어 이메일 모두 기록됩니다.

---

## 사용자

### GET `/api/me/stats`

현재 로그인한 사용자의 게임 통계를 반환합니다.

**헤더:** `Authorization: Bearer <token>` 필요 (requireAuth)

**응답 (200 OK):**
```json
{
  "stats": {
    "totalGames": 42,
    "wins": 20,
    "losses": 15,
    "draws": 7,
    "winRate": 47.6,
    "aiGames": 30,
    "onlineGames": 12
  }
}
```

---

### GET `/api/ranking`

전체 랭킹 상위 50명을 반환합니다 (온라인 게임 기준).

**인증 불필요**

**응답 (200 OK):**
```json
{
  "ranking": [
    {
      "rank": 1,
      "email": "top@school.com",
      "name": "이순신",
      "wins": 30,
      "losses": 5,
      "draws": 3,
      "totalGames": 38,
      "winRate": 78.9
    }
    // ...
  ]
}
```

**정렬 기준:** 승리 수 내림차순 → 패배 수 오름차순 → 총 게임 수 내림차순

---

## 기타

### GET `/health`

서버 상태를 확인합니다.

**응답 (200 OK):**
```json
{ "status": "ok" }
```
