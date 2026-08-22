import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// next dev / next build は .env を自動で読むが、Vitest は読まない。
// tests/db/ は DATABASE_URL が要る。Node 24 の組み込み関数で読むので、
// dotenv も vite の loadEnv（vitest の推移的依存）も足さずに済む。
//
// .env は .gitignore 対象なので、CI・clone 直後・新しい worktree には存在しない。
// process.loadEnvFile は無いファイルで throw し、それは設定ファイルの読み込み時点なので
// DB を触らないテストまで巻き添えで落ちる。存在するときだけ読み、
// 無ければ実環境変数の DATABASE_URL に委ねる（prisma.config.ts と同じ形）。
const envPath = fileURLToPath(new URL('./.env', import.meta.url))
if (existsSync(envPath)) process.loadEnvFile(envPath)

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 本番コードの `import 'server-only'` は残したまま、テストでだけ無害化する
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    env: { DATABASE_URL: process.env.DATABASE_URL ?? '' },
    // tests/db/ が2ファイルになった。同じ DB を並列に TRUNCATE し合うと
    // 互いのテストデータを消し合うため、ファイル単位の並列実行を止める。
    fileParallelism: false,
  },
})
