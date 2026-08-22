import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// next dev / next build は .env を自動で読むが、Vitest は読まない。
// tests/db/ は DATABASE_URL が要る。Node 24 の組み込み関数で読むので、
// dotenv も vite の loadEnv（vitest の推移的依存）も足さずに済む。
process.loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)))

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
  },
})
