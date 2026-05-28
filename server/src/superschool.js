const LOGIN_URL  = 'https://front.superschool.link/api-v2/auth/school-login'
const ME_URL     = 'https://web.superschool.link/api/users/me'
const LOGOUT_URL = 'https://front.superschool.link/api-v2/auth/school-logout'

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'ko-KR,ko;q=0.9',
}

async function ssLogin(loginId, password) {
  const resp = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'Origin': 'https://front.superschool.link',
      'Referer': 'https://front.superschool.link/login',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ loginId, password }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw Object.assign(new Error('SuperSchool 로그인 실패'), { status: resp.status, body: text })
  }

  const data = await resp.json()
  if (data.requireMfa) throw new Error('MFA 계정은 지원되지 않습니다')
  if (!data.accessToken) throw new Error('accessToken 없음')
  return data.accessToken
}

async function ssGetUser(token) {
  const resp = await fetch(ME_URL, {
    headers: {
      ...COMMON_HEADERS,
      'Origin': 'https://front.superschool.link',
      'Referer': 'https://front.superschool.link/',
      'Cookie': `access_token=${token}`,
    },
  })
  if (!resp.ok) throw new Error('유저 정보 조회 실패')
  return resp.json()
}

async function ssLogout(token) {
  try {
    await fetch(LOGOUT_URL, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Origin': 'https://front.superschool.link',
        'Referer': 'https://front.superschool.link/student/mypage',
        'Cookie': `access_token=${token}`,
      },
    })
  } catch {
    // 로그아웃 실패해도 무방 — 서버 세션은 자동 만료
  }
}

/**
 * 슈퍼스쿨 로그인 → 정보 수집 → 로그아웃.
 * 반환값에 SuperSchool 토큰은 포함되지 않는다.
 */
export async function superschoolAuth(loginId, password) {
  const token = await ssLogin(loginId, password)
  let raw
  try {
    raw = await ssGetUser(token)
  } finally {
    await ssLogout(token)
  }

  const grade  = raw.groupGrade ?? 0
  const klass  = raw.groupKlass ?? 0
  const number = parseInt(raw.studentNumber ?? '0', 10)

  return {
    email:      raw.email,
    name:       raw.name,
    studentId:  `${grade}${String(klass).padStart(2, '0')}${String(number).padStart(2, '0')}`,
    grade,
    klass,
    school:     raw.school?.name ?? '',
  }
}
