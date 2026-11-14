import { beforeEach, describe, expect, it } from 'vitest'
import { hashPassword } from 'better-auth/crypto'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createUser, resetDb } from './helpers'

const origin = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
const password = 'local-auth-test-only-password'

function post(path: string, body: object, cookie = '') {
  return auth.handler(new Request(`${origin}/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
    body: JSON.stringify(body),
  }))
}

function session(cookie: string) {
  return auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: { Cookie: cookie } }))
}

describe('メール・パスワード認証', () => {
  beforeEach(resetDb)

  it('登録、ログイン、セッション取得、ログアウトが実 DB で動く', async () => {
    const email = 'auth-flow@example.com'
    const signup = await post('sign-up/email', { name: 'Auth test', email, password })
    expect(signup.status).toBe(200)

    const signin = await post('sign-in/email', { email, password })
    expect(signin.status).toBe(200)
    const cookies = signin.headers.getSetCookie()
    expect(cookies.some((cookie) => /httponly/i.test(cookie))).toBe(true)
    const cookie = cookies.map((value) => value.split(';')[0]).join('; ')
    const current = await session(cookie)
    expect((await current.json()).user.email).toBe(email)

    const signout = await post('sign-out', {}, cookie)
    expect(signout.status).toBe(200)
    expect(await (await session(cookie)).json()).toBeNull()
  })

  it('旧 issuer 値を持つアカウントでもログインでき、既存値を保持する', async () => {
    const email = 'legacy-auth@example.com'
    const user = await createUser(email)
    const account = await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        issuer: 'legacy-credential',
        password: await hashPassword(password),
      },
    })

    expect((await post('sign-in/email', { email, password })).status).toBe(200)
    expect((await prisma.account.findUnique({ where: { id: account.id } }))?.issuer)
      .toBe('legacy-credential')
  })

  it('誤ったパスワードではログインできない', async () => {
    const email = 'wrong-password@example.com'
    expect((await post('sign-up/email', { name: 'Auth test', email, password })).status).toBe(200)
    const response = await post('sign-in/email', { email, password: 'incorrect-password' })

    expect(response.status).toBe(401)
    expect(await (await session('')).json()).toBeNull()
  })
})
