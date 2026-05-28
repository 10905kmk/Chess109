# 인증 흐름

## 개요

Chess109는 자체 계정 시스템 없이 **SuperSchool** 학교 계정으로 로그인합니다.
서버가 SuperSchool API를 대신 호출(프록시)하여 학생 정보를 가져온 뒤,
자체 JWT를 발급합니다. 사용자 비밀번호나 SuperSchool 토큰은 저장하지 않습니다.

## 로그인 흐름

```
클라이언트                      서버                         SuperSchool API
    │                            │                                 │
    │  POST /auth/login           │                                 │
    │  { loginId, password }      │                                 │
    ├───────────────────────────►│                                 │
    │                            │  POST /api-v2/auth/school-login │
    │                            │  { loginId, password }          │
    │                            ├────────────────────────────────►│
    │                            │◄────────────────────────────────┤
    │                            │  SS 액세스 토큰 반환              │
    │                            │                                 │
    │                            │  GET /api/users/me              │
    │                            │  Authorization: Bearer SS토큰   │
    │                            ├────────────────────────────────►│
    │                            │◄────────────────────────────────┤
    │                            │  사용자 정보 반환                  │
    │                            │  (name, email, grade, klass...) │
    │                            │                                 │
    │                            │  POST /api-v2/auth/logout       │
    │                            │  (SS 토큰 즉시 폐기)              │
    │                            ├────────────────────────────────►│
    │                            │                                 │
    │                            │  DB upsert (users 테이블)        │
    │                            │  Chess109 JWT 발급 (7일)         │
    │                            │                                 │
    │◄───────────────────────────┤                                 │
    │  { token, user }           │                                 │
    │                            │                                 │
    │  localStorage에 토큰 저장   │                                 │
    │  (key: chess109_token)      │                                 │
```

## 토큰 사용

로그인 이후 모든 인증이 필요한 API 요청에는 JWT를 헤더에 포함합니다:

```
Authorization: Bearer <JWT_TOKEN>
```

JWT에는 다음 정보가 포함됩니다:
- `email` - 사용자 이메일 (Primary Key)
- `name` - 학생 이름
- `studentId` - 학번
- `grade` - 학년
- `klass` - 반
- `school` - 학교명

## 클라이언트 - useAuth 훅

`client/src/hooks/useAuth.jsx`에서 인증 상태를 전역으로 관리합니다.

```javascript
// 제공하는 값
{
  user,             // 현재 유저 객체 (null이면 미로그인)
  loading,          // 초기 토큰 검증 중 여부
  login(),          // SuperSchool 로그인 함수
  loginAsGuest(),   // 게스트 로그인 함수
  logout(),         // 로그아웃 (토큰 삭제 + user 초기화)
  getToken(),       // localStorage에서 JWT 반환 (게스트는 null)
}
```

앱 시작 시 `localStorage`에 토큰이 있으면 `/auth/me`를 호출해 유효성을 검증하고 `user`를 복원합니다.

## 게스트 모드

SuperSchool 계정 없이도 게스트로 앱을 사용할 수 있습니다.

**`loginAsGuest()` 동작:**
- localStorage 토큰을 삭제합니다.
- `user`를 `{ name: '게스트', isGuest: true }`로 설정합니다.
- 서버 통신 없음, JWT 없음.

**게스트 제한사항:**

| 기능 | 게스트 |
|------|--------|
| 로컬 대전 | 가능 |
| AI 대전 | 가능 |
| 친선전 (/online) | 가능 |
| 자동 매칭 (/match) | **불가** |
| 내 전적 (/me) | **불가** |
| 랭킹 (/ranking) | 불가 (RequireFullAuth) |
| 게임 결과 DB 저장 | **미저장** (이메일 없으므로 서버에서 스킵) |

**라우팅 가드:**
- `RequireAuth`: 미로그인(user === null)만 차단. 게스트는 통과.
- `RequireFullAuth`: 미로그인 + `user.isGuest === true` 모두 차단 → `/`로 리다이렉트.

`/match`는 `RequireFullAuth`로 보호됩니다.

## 서버 - 인증 미들웨어

`server/src/index.js`의 `requireAuth` 미들웨어:

```javascript
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  // 토큰 없음 → 401
  // jwt.verify 실패 → 401
  // 성공 → req.user에 디코딩된 정보 저장 → next()
}
```

보호된 라우트: `/api/game/result`, `/api/me/stats`

## 보안 원칙

- **비밀번호 미저장**: 서버는 SuperSchool로 인증 후 비밀번호를 절대 저장하지 않습니다.
- **SS 토큰 즉시 폐기**: 사용자 정보 조회 후 SuperSchool 토큰을 바로 로그아웃 처리합니다.
- **JWT 만료**: 발급된 JWT는 7일 후 만료됩니다.
- **서버 사이드 프록시**: SuperSchool 인증은 서버를 통해서만 이루어져 CORS 및 토큰 노출 방지합니다.
