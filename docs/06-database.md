# 데이터베이스

## 환경

| 환경 | DB | 설정 |
|------|-----|------|
| 개발 | PostgreSQL (Docker) | `localhost:5434` |
| 프로덕션 | PostgreSQL (Supabase) | 환경변수 `DATABASE_URL` |

ORM: **Prisma 5.22.0**  
스키마: `server/prisma/schema.prisma`

---

## 스키마

### users 테이블

```prisma
model User {
  email      String   @id
  name       String
  studentId  String   @map("student_id")
  grade      Int
  klass      Int
  school     String
  createdAt  DateTime @default(now()) @map("created_at")
  lastLogin  DateTime @default(now()) @map("last_login")

  @@map("users")
}
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `email` | TEXT (PK) | SuperSchool 이메일 (기본키) |
| `name` | TEXT | 학생 이름 |
| `student_id` | TEXT | 학번 |
| `grade` | INT | 학년 |
| `klass` | INT | 반 |
| `school` | TEXT | 학교명 |
| `created_at` | TIMESTAMP | 최초 가입 시각 |
| `last_login` | TIMESTAMP | 마지막 로그인 시각 |

---

### game_results 테이블

```prisma
model GameResult {
  id         Int      @id @default(autoincrement())
  whiteEmail String   @map("white_email")
  blackEmail String   @map("black_email")
  result     String
  mode       String
  createdAt  DateTime @default(now()) @map("created_at")

  @@map("game_results")
}
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INT (PK) | 자동 증가 |
| `white_email` | TEXT | 백 플레이어 이메일 |
| `black_email` | TEXT | 흑 플레이어 이메일 |
| `result` | TEXT | `"white"` \| `"black"` \| `"draw"` |
| `mode` | TEXT | `"ai"` \| `"online"` |
| `created_at` | TIMESTAMP | 게임 종료 시각 |

> AI 대전에서 AI의 이메일은 `"stockfish"`로 기록됩니다.

---

## 주요 쿼리 (`server/src/db.js`)

### upsertUser
로그인 시 사용자가 없으면 생성, 있으면 `last_login`을 업데이트합니다.

```javascript
await prisma.user.upsert({
  where: { email },
  update: { lastLogin: new Date() },
  create: { email, name, studentId, grade, klass, school }
});
```

### saveGameResult
게임 결과를 저장합니다.

```javascript
await prisma.gameResult.create({
  data: { whiteEmail, blackEmail, result, mode }
});
```

### getUserStats
특정 사용자의 전체 전적을 집계합니다.
Prisma `$queryRaw`로 PostgreSQL의 `FILTER` 절을 활용합니다.

```sql
SELECT
  COUNT(*)                                          AS total_games,
  COUNT(*) FILTER (WHERE result_for_user = 'win')   AS wins,
  COUNT(*) FILTER (WHERE result_for_user = 'loss')  AS losses,
  COUNT(*) FILTER (WHERE result_for_user = 'draw')  AS draws,
  COUNT(*) FILTER (WHERE mode = 'ai')               AS ai_games,
  COUNT(*) FILTER (WHERE mode = 'online')           AS online_games
FROM (
  -- 백으로 플레이한 게임과 흑으로 플레이한 게임을 UNION ALL
  SELECT
    CASE
      WHEN result = 'white' THEN 'win'
      WHEN result = 'black' THEN 'loss'
      ELSE 'draw'
    END AS result_for_user, mode
  FROM game_results WHERE white_email = $1

  UNION ALL

  SELECT
    CASE
      WHEN result = 'black' THEN 'win'
      WHEN result = 'white' THEN 'loss'
      ELSE 'draw'
    END AS result_for_user, mode
  FROM game_results WHERE black_email = $1
) AS combined
```

### getRanking
온라인 게임만 집계하여 상위 50명을 반환합니다.

**정렬 기준:** 승리 수 내림차순 → 패배 수 오름차순 → 총 게임 수 내림차순

---

## 마이그레이션

```bash
# 새 마이그레이션 생성
cd server
npx prisma migrate dev --name <마이그레이션_이름>

# 프로덕션 마이그레이션 적용
npx prisma migrate deploy

# Prisma Studio (DB 브라우저)
npx prisma studio
```

마이그레이션 파일 위치: `server/prisma/migrations/`
