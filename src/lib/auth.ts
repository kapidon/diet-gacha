import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '@/lib/db'

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
