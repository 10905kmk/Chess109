import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

export async function upsertUser({ email, name, studentId, grade, klass, school }) {
  return prisma.user.upsert({
    where: { email },
    create: { email, name, studentId, grade, klass, school },
    update: { name, studentId, grade, klass, school, lastLogin: new Date() },
  })
}

export async function getUserByEmail(email) {
  return prisma.user.findUnique({ where: { email } })
}

export async function recordGame({ whiteEmail, blackEmail, result, mode }) {
  return prisma.gameResult.create({
    data: { whiteEmail, blackEmail, result, mode },
  })
}

export async function getRanking() {
  return prisma.$queryRaw`
    SELECT
      u.email,
      u.name,
      u.grade,
      u.klass,
      u.school,
      COUNT(*) FILTER (WHERE
        (gr.white_email = u.email AND gr.result = 'white') OR
        (gr.black_email = u.email AND gr.result = 'black')
      )::int AS wins,
      COUNT(*) FILTER (WHERE
        (gr.white_email = u.email AND gr.result = 'black') OR
        (gr.black_email = u.email AND gr.result = 'white')
      )::int AS losses,
      COUNT(*) FILTER (WHERE gr.result = 'draw')::int AS draws,
      COUNT(gr.id)::int AS total
    FROM users u
    JOIN game_results gr
      ON (gr.white_email = u.email OR gr.black_email = u.email)
      AND gr.mode = 'online'
    GROUP BY u.email, u.name, u.grade, u.klass, u.school
    ORDER BY wins DESC, losses ASC, total DESC
    LIMIT 50
  `
}

export async function getUserStats(email) {
  const defaultStats = { wins: 0, losses: 0, draws: 0, total: 0 }
  const [onlineRows, aiRows, recentRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE
          (white_email = ${email} AND result = 'white') OR
          (black_email = ${email} AND result = 'black')
        )::int AS wins,
        COUNT(*) FILTER (WHERE
          (white_email = ${email} AND result = 'black') OR
          (black_email = ${email} AND result = 'white')
        )::int AS losses,
        COUNT(*) FILTER (WHERE result = 'draw')::int AS draws,
        COUNT(*)::int AS total
      FROM game_results
      WHERE (white_email = ${email} OR black_email = ${email}) AND mode = 'online'
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE
          (white_email = ${email} AND result = 'white') OR
          (black_email = ${email} AND result = 'black')
        )::int AS wins,
        COUNT(*) FILTER (WHERE
          (white_email = ${email} AND result = 'black') OR
          (black_email = ${email} AND result = 'white')
        )::int AS losses,
        COUNT(*) FILTER (WHERE result = 'draw')::int AS draws,
        COUNT(*)::int AS total
      FROM game_results
      WHERE (white_email = ${email} OR black_email = ${email}) AND mode = 'ai'
    `,
    prisma.$queryRaw`
      SELECT
        gr.id::int,
        gr.white_email,
        gr.black_email,
        gr.result,
        gr.mode,
        gr.created_at,
        wu.name AS white_name,
        bu.name AS black_name
      FROM game_results gr
      LEFT JOIN users wu ON wu.email = gr.white_email
      LEFT JOIN users bu ON bu.email = gr.black_email
      WHERE gr.white_email = ${email} OR gr.black_email = ${email}
      ORDER BY gr.created_at DESC
      LIMIT 10
    `,
  ])

  return {
    online: onlineRows[0] ?? defaultStats,
    ai: aiRows[0] ?? defaultStats,
    recentGames: recentRows.map(g => {
      const isWhite = g.white_email === email
      const opponentEmail = isWhite ? g.black_email : g.white_email
      const opponentName  = isWhite ? g.black_name  : g.white_name
      let playerResult = 'draw'
      if (g.result !== 'draw') {
        playerResult = (isWhite && g.result === 'white') || (!isWhite && g.result === 'black')
          ? 'win' : 'loss'
      }
      return {
        id: g.id,
        mode: g.mode,
        result: g.result,
        playerResult,
        playerColor: isWhite ? 'w' : 'b',
        opponentName: opponentName || opponentEmail,
        createdAt: g.created_at,
      }
    }),
  }
}
