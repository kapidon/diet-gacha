import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
// `auth` CLI は jiti でこのファイルを読むが tsconfig の `@/` エイリアスを解決できないため、
// ここだけ相対 import にしている。
import { prisma } from './db'

// secret と baseURL は BETTER_AUTH_SECRET / BETTER_AUTH_URL から読まれる。
// メール+パスワードのみ。ソーシャルログインは第1弾のスコープ外。
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
})
