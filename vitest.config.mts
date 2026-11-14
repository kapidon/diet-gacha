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

// VITEST_MAX_WORKERS は resolveConfig の後段で maxWorkers を無条件に上書きする
// （db プロジェクトの fileParallelism: false による maxWorkers=1 も含めて）。
// 上書きされると tests/db/ のファイル間直列化が外れ、同じテスト用DBへの
// TRUNCATE が競合してテストが不安定に落ちる。黙って壊れるより起動時に落ちてほしい。
const maxWorkersEnv = process.env.VITEST_MAX_WORKERS
if (maxWorkersEnv !== undefined && Number.parseInt(maxWorkersEnv, 10) !== 1) {
  throw new Error(
    `VITEST_MAX_WORKERS=${maxWorkersEnv} は db プロジェクトの fileParallelism: false を上書きし、` +
      'tests/db/ のファイル間 TRUNCATE 競合を防げなくなる。1 にするか未設定にすること。',
  )
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 本番コードの `import 'server-only'` は残したまま、テストでだけ無害化する
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    env: { DATABASE_URL: process.env.DATABASE_URL ?? '' },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // DB に触れるテストは置かない（tests/db/ を使う）。ここに置くと
          // db プロジェクトの直列化の対象外になり、TRUNCATE が競合しうる。
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['tests/**/*.test.ts'],
          // tests/db/ が2ファイルになった。同じ DB を並列に TRUNCATE し合うと
          // 互いのテストデータを消し合うため、このプロジェクトだけファイル単位の
          // 並列実行を止める。DB を触らない unit プロジェクトは並列のまま。
          //
          // isolate: false は付けない。maxWorkers が unit（CPU数）と食い違い、
          // 'have different maxWorkers but same groupOrder' で起動時エラーになる。
          fileParallelism: false,
        },
      },
    ],
  },
})
