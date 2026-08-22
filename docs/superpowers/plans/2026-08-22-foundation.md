# diet-gacha 第1弾（基盤）実装計画

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task.
> どちらも利用できない環境では、このチェックボックスをタスク単位で順に実行し、
> `AGENTS.md` の「レビューを受ける」に該当する変更だけ独立したレビューに回す。
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ログインして自分の習慣を登録し、日々の達成をチェックするとチケットが貯まるところまでを動かす。

**Architecture:** Next.js 16 App Router。データアクセスは `src/data/` の DAL に一本化し、Server Action は DAL の呼び出しと `revalidatePath` のみを行う。集計値（チケット残高・継続日数・週の目標回数）はカラムに持たず都度計算する。日付・週の計算は `src/lib/date.ts` の純粋関数に切り出す。

**Tech Stack:** Next.js 16.3.1 / React 19.2.8 / TypeScript / Tailwind CSS v4 / Prisma 7.9.1 / PostgreSQL 18 / Better Auth 1.7.1 / Vitest 4.1.11

**Spec:** `docs/superpowers/specs/2026-08-21-architecture-design.md`

## Global Constraints

- Node.js は `.node-version` の `24.19.0`。fnm が `cd` で切り替える。Prisma 7 は Node 20.19+ / 22.12+ / 24.0+ でないと **インストール時に失敗する**
- **`prisma migrate dev` は Prisma Client を生成しない。** `--help` には "trigger generators" と書いてあるが、7.9.1 の実挙動は生成しない（実測）。スキーマを変えたら必ず `npx prisma generate` を続けて実行する
- Prisma 7 の `prisma-client` generator が出力するのは **TypeScript**（`client.ts`）。素の `node` からは import できない。Next.js か Vitest のトランスパイルを通す
- `prisma migrate dev` は必要に応じて対話プロンプトを出し、非対話環境では `Prisma Migrate has detected that the environment is non-interactive` で失敗する。プロンプトが必要になったら人間に渡す
- 新しいライブラリの追加は、理由と代替案を示して承認を得てから行う。この計画で追加してよいのは次のみ: `prisma`, `@prisma/client`, `@prisma/adapter-pg`, `better-auth`, `@better-auth/cli`, `server-only`, `vitest`
- 状態管理ライブラリを入れない。`useState` / `useContext` の範囲に留める
- レイヤー分割や DI を導入しない。Repository インターフェースを作らない
- `page.tsx` から Prisma を直接呼ばない。必ず `src/data/` を経由する
- 認証チェックはレイアウトに置かない。DAL の中で行う
- `proxy.ts` を作らない
- Route Handler は Better Auth の `/api/auth/[...all]` だけ
- 集計で求まる値（チケット残高、継続日数、週の目標回数）をカラムに持たない
- UI は Tailwind のデフォルトで十分。装飾に凝らない
- 日付境界は JST 0時。週は月曜始まり
- コミットは Conventional Commits。subject は日本語で、何をしたかを書く
- リポジトリに残る文章に、作者の経歴や個人的な事情を書かない
- **記憶で API を書かない。** Next.js の仕様は `node_modules/next/dist/docs/` を読む。それ以外は公式ドキュメントを読む

## この計画で扱わない範囲

ガチャ、図鑑、ご褒美の紐付け、推移表示、公開ページと OG 画像、E2E テストは **第2弾の計画**で扱う。
この計画の完了時点で「習慣を登録して、チェックすると未使用チケットが増える」ところまで動く。

## ファイル構成

| ファイル | 責務 |
|---|---|
| `prisma/schema.prisma` | データモデル。Better Auth の生成モデルもここに入る |
| `prisma.config.ts` | Prisma 7 の設定。接続 URL はここ（schema には書けない） |
| `src/lib/db.ts` | Prisma クライアントの生成。開発時の多重生成を防ぐ |
| `src/lib/date.ts` | JST・週境界・継続日数の純粋関数。DB を知らない |
| `src/lib/date.test.ts` | 上のテスト |
| `src/lib/auth.ts` | Better Auth のサーバー設定 |
| `src/lib/auth-client.ts` | Better Auth のクライアント設定 |
| `src/app/api/auth/[...all]/route.ts` | Better Auth のエンドポイント |
| `src/data/session.ts` | セッション取得と `requireUser`。`cache()` で包む |
| `src/data/habits.ts` | 習慣の取得・作成・更新・アーカイブ |
| `src/data/checkins.ts` | 達成の記録と取り消し。チケット発行を含む |
| `src/app/(auth)/…` | ログイン・新規登録 |
| `src/app/(app)/…` | ログイン後の画面 |
| `tests/db/…` | 実 DB を使うテスト |

## コミットの分け方

タスクは**レビューの単位**、コミットは**変更の単位**。同じとは限らない。
1つのタスクに独立して意味が通る変更が2つあれば、コミットも2つに分ける。

分ける基準はひとつ。**その時点で `npm run build` と `npm test` が通り、かつ単独で意味が通るか。**
通らないなら分けない。

ただし `test` script は Task 2 で追加する。**Task 1 のコミットは `npm run lint && npm run build` が通れば足りる。**

| Task | コミット数 | 分け方 |
|---|---|---|
| 1 | 1 | 設定・スキーマ・クライアントは分けるとビルドが通らない |
| 2 | 1 | Vitest だけ入れてもテストファイルが無く `vitest run` が失敗するため分けられない |
| 3 | 2 | `feat: 認証の基盤を追加`（設定・スキーマ・エンドポイント） → `feat: ログインと新規登録の画面を追加` |
| 4 | 1 | 小さい |
| 5 | 2 | `feat: 習慣の入力検証を追加`（検証関数とテスト） → `feat: 習慣の登録・編集・削除を追加` |
| 6 | 2 | `feat: 達成のチェックとチケット発行を追加`（DAL とDBテスト） → `feat: 今日の画面を追加` |
| 7 | 1 | 小さい |

合計10コミット。

TDD のステップの途中ではコミットしない。**赤いテストをコミットすると「その時点でテストが通る」が崩れる**ため、
テストと実装は同じコミットに入れる。

---

---

## Task 1: Prisma とデータベース

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `src/lib/db.ts`
- Create: `.env`（コミットしない）
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: なし
- Produces: `import { prisma } from '@/lib/db'` — `PrismaClient` のインスタンス

- [ ] **Step 1: テスト用 DB が動いていることを確認する**

```bash
docker compose up -d
docker exec diet-gacha-test-db psql -U postgres -d diet_gacha_test -tAc "SELECT version();"
```

Expected: `PostgreSQL 18.6 ...` が返る

- [ ] **Step 2: パッケージを入れ、生成を自動化する**

```bash
npm install prisma@7.9.1 @prisma/client@7.9.1 @prisma/adapter-pg@7.9.1 server-only
```

`package.json` の `scripts` に追加する。

```json
"postinstall": "prisma generate"
```

生成物は `.gitignore` に入れる（Step 12）ので、クリーンな clone や CI では `npm ci` の時点で生成されている必要がある。
`build` の前処理にしないのは、`npm ci` 直後の `npm run lint` や型チェックでも生成物が要るため。

- [ ] **Step 3: `.env` を作り、`.gitignore` を確認する**

`.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/diet_gacha_test"
```

`.gitignore` に `.env*` が含まれていることを確認する。`create-next-app` が既に入れているはずだが、無ければ追加する。

- [ ] **Step 4: `prisma.config.ts` を作る**

Prisma 7 では接続 URL を `schema.prisma` に書けない（`The datasource property 'url' is no longer supported in schema files.` というエラーになる）。

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
```

- [ ] **Step 5: `prisma/schema.prisma` を作る**

設計書「8. データモデル」のスキーマをそのまま写す。`prisma validate` を通した状態のものなので、変更しない。

先頭は次のとおり。

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

続けて設計書の `enum Weekday` と7つの `model`（`ShareLink` / `Habit` / `HabitLog` / `Ticket` / `Card` / `GachaResult` / `UserCard`）を写す。`User` モデルはこの時点では書かない（Task 3 で Better Auth が生成する）。

`User` への `@relation` を含む行は、Task 3 まで一時的にコメントアウトしておく。具体的には `ShareLink.user` と `Habit.user` の2行。

- [ ] **Step 6: 検証する**

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

失敗した場合は設計書の写し間違い。1:1 リレーションには `fields:` に並べた組み合わせそのものへの `@@unique` が必要で、これが欠けると
`A one-to-one relation must use unique fields on the defining side` になる。

- [ ] **Step 7: マイグレーションを作って適用する**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/<timestamp>_init/migration.sql` が生成され、テスト DB に適用される

**この時点では `src/generated` はまだ存在しない。** `migrate dev` は generator を動かさない（実測）。

- [ ] **Step 8: CHECK 制約を追加するマイグレーションを作る**

Prisma のスキーマでは表現できないため、空のマイグレーションを作って SQL を書く。

```bash
npx prisma migrate dev --create-only --name add_check_constraints
```

生成された `migration.sql` に次を書く。

```sql
ALTER TABLE "Ticket" ADD CONSTRAINT ticket_daily_seq CHECK ("dailySeq" BETWEEN 1 AND 3);
ALTER TABLE "Card"   ADD CONSTRAINT card_rarity      CHECK ("rarity" BETWEEN 1 AND 4);
ALTER TABLE "Habit"  ADD CONSTRAINT habit_days_count CHECK (cardinality("daysOfWeek") BETWEEN 1 AND 7);
```

```bash
npx prisma migrate dev
npx prisma generate
```

Expected: `✔ Generated Prisma Client (7.9.1) to ./src/generated/prisma`

- [ ] **Step 9: 制約が効くことを確かめる**

```bash
docker exec diet-gacha-test-db psql -U postgres -d diet_gacha_test -c \
  "INSERT INTO \"Card\" (id,name,\"flavorText\",rarity,emoji) VALUES (1,'x','y',9,'z');"
```

Expected: `new row for relation "Card" violates check constraint "card_rarity"`

- [ ] **Step 10: `src/lib/db.ts` を作る**

開発時に `next dev` がモジュールを再読み込みするたび新しいクライアントが作られ、接続を使い果たすのを防ぐ。`globalThis` に保持するのが定石。

```ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

`@prisma/adapter-pg` のエクスポート名と引数は記憶で書かず、`node_modules/@prisma/adapter-pg` の型定義（`.d.ts`）を開いて確認してから書くこと。

- [ ] **Step 11: ビルドが通ることを確認する**

```bash
npm run build
```

Expected: 成功

生成物を消した状態からも通ることを確認する。`postinstall` が効いているかの確認になる。

```bash
rm -rf src/generated && npm ci && npm run build
```

- [ ] **Step 12: `.gitignore` に生成物を追加する**

```
/src/generated
```

- [ ] **Step 13: コミット**

```bash
git add prisma prisma.config.ts src/lib/db.ts .gitignore package.json package-lock.json
git commit -m "feat: Prisma とデータモデルを追加"
```

---

## Task 2: Vitest と日付の純粋関数

**Files:**
- Create: `src/lib/date.ts`
- Create: `src/lib/date.test.ts`
- Create: `vitest.config.ts`
- Create: `tests/stubs/server-only.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: なし
- Produces:
  - `jstDateString(d: Date): string` — JST の `'YYYY-MM-DD'`
  - `addDays(dateStr: string, n: number): string`
  - `diffDays(a: string, b: string): number` — `a - b` の日数
  - `jstWeekday(dateStr: string): Weekday` — `'MON'`〜`'SUN'`
  - `isoWeekStart(dateStr: string): string` — その週の月曜
  - `calcStreak(dates: string[], today: string): number`
  - `calcWeeklyStreak(dates: string[], target: number, today: string): number`

- [ ] **Step 1: Vitest を入れる**

```bash
npm install -D vitest
```

`package.json` の `scripts` に追加する。

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: `vitest.config.ts` を作る**

`@/` のパス別名に加えて、`server-only` を空モジュールへ差し替える必要がある。

`server-only` は `react-server` 条件のときだけ空ファイルを返し、それ以外では
`index.js` が即座に throw する marker package である（`node_modules/server-only/package.json` の
`exports` と `index.js` で確認できる）。Next.js はこの import を自前の解決層で処理するが、
素の Vitest はそこを通らないため、DAL を import した瞬間に
`Error: This module cannot be imported from a Client Component module.` でテストファイルごと落ちる。**実測で確認済み。**

一般的には「テストから import するモジュールに `server-only` を付けない」という回避もあるが、
ここでは本番コード側の `import 'server-only'` を残すことを優先し、テスト設定側で差し替える。
DAL がクライアントに漏れないという保証は本番のビルドで効いていればよく、テスト実行時には不要なため。

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

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
  },
})
```

`tests/stubs/server-only.ts` は空にする。

```ts
export {}
```

- [ ] **Step 3: 失敗するテストを書く**

`src/lib/date.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addDays, calcStreak, calcWeeklyStreak, diffDays,
  isoWeekStart, jstDateString, jstWeekday,
} from './date'

describe('jstDateString', () => {
  it('UTC 14:59 は当日', () => {
    expect(jstDateString(new Date('2026-08-22T14:59:00Z'))).toBe('2026-08-22')
  })
  it('UTC 15:00（JST 翌0時）は翌日', () => {
    expect(jstDateString(new Date('2026-08-22T15:00:00Z'))).toBe('2026-08-23')
  })
})

describe('jstWeekday', () => {
  it('2026-08-24 は月曜', () => expect(jstWeekday('2026-08-24')).toBe('MON'))
  it('2026-08-23 は日曜', () => expect(jstWeekday('2026-08-23')).toBe('SUN'))
})

describe('isoWeekStart', () => {
  it('日曜はその週の月曜へ戻る', () => expect(isoWeekStart('2026-08-23')).toBe('2026-08-17'))
  it('月曜はそのまま', () => expect(isoWeekStart('2026-08-24')).toBe('2026-08-24'))
})

describe('diffDays', () => {
  it('3日差', () => expect(diffDays('2026-08-24', '2026-08-21')).toBe(3))
})

describe('addDays', () => {
  it('月末をまたぐ', () => expect(addDays('2026-08-31', 1)).toBe('2026-09-01'))
})

describe('calcStreak', () => {
  it('記録なしは 0', () => expect(calcStreak([], '2026-08-24')).toBe(0))
  it('今日のみは 1', () => expect(calcStreak(['2026-08-24'], '2026-08-24')).toBe(1))
  it('昨日まで（今日未記録）でも継続', () => expect(calcStreak(['2026-08-23'], '2026-08-24')).toBe(1))
  it('1日空き（月・水）は継続して 2', () => {
    expect(calcStreak(['2026-08-24', '2026-08-26'], '2026-08-26')).toBe(2)
  })
  it('2日空き（月・木）は途切れる', () => {
    expect(calcStreak(['2026-08-24', '2026-08-27'], '2026-08-27')).toBe(1)
  })
  it('最終記録が today-2 なら生きている', () => {
    expect(calcStreak(['2026-08-22'], '2026-08-24')).toBe(1)
  })
  it('最終記録が today-3 なら 0', () => {
    expect(calcStreak(['2026-08-21'], '2026-08-24')).toBe(0)
  })
  it('連続5日', () => {
    const dates = ['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23', '2026-08-24']
    expect(calcStreak(dates, '2026-08-24')).toBe(5)
  })
})

describe('calcWeeklyStreak', () => {
  it('今週が未達でも前週までを返す', () => {
    const dates = ['2026-08-17', '2026-08-19', '2026-08-21', '2026-08-24']
    expect(calcWeeklyStreak(dates, 3, '2026-08-25')).toBe(1)
  })
  it('今週も達成していれば +1', () => {
    const dates = ['2026-08-17', '2026-08-19', '2026-08-21', '2026-08-24', '2026-08-25', '2026-08-26']
    expect(calcWeeklyStreak(dates, 3, '2026-08-26')).toBe(2)
  })
  it('未達の週で打ち切る', () => {
    const dates = ['2026-08-10', '2026-08-17', '2026-08-19', '2026-08-21']
    expect(calcWeeklyStreak(dates, 3, '2026-08-25')).toBe(1)
  })
  it('記録なしは 0', () => expect(calcWeeklyStreak([], 3, '2026-08-25')).toBe(0))
})
```

- [ ] **Step 4: 失敗することを確認する**

```bash
npm test
```

Expected: FAIL（`Cannot find module './date'`）

- [ ] **Step 5: 実装する**

`src/lib/date.ts`:

```ts
import type { Weekday } from '@/generated/prisma/client'

const JST = 'Asia/Tokyo'
const WEEKDAYS: Weekday[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** Date から JST での 'YYYY-MM-DD' を得る。en-CA は YYYY-MM-DD 形式で出力される。 */
export function jstDateString(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/** 'YYYY-MM-DD' を UTC 0時のミリ秒に変換する。日付計算をタイムゾーンから切り離すため。 */
function toUtcMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(dateStr: string, n: number): string {
  return new Date(toUtcMidnight(dateStr) + n * 86_400_000).toISOString().slice(0, 10)
}

/** a - b の日数。 */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtcMidnight(a) - toUtcMidnight(b)) / 86_400_000)
}

export function jstWeekday(dateStr: string): Weekday {
  return WEEKDAYS[new Date(toUtcMidnight(dateStr)).getUTCDay()]
}

/** その日が属する週（月曜始まり）の月曜を返す。 */
export function isoWeekStart(dateStr: string): string {
  const day = new Date(toUtcMidnight(dateStr)).getUTCDay()
  const backToMonday = day === 0 ? 6 : day - 1
  return addDays(dateStr, -backToMonday)
}

/**
 * 継続日数。記録した日数を数える（暦の日数ではない）。
 * 1日の空白は許容し、2日連続で空いたら途切れる。
 * today を受け取るのは、最後の記録日と今日の距離にも同じ規則が適用されるため。
 */
export function calcStreak(dates: string[], today: string): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates)].sort().reverse()
  if (diffDays(today, sorted[0]) > 2) return 0

  let count = 1
  for (let i = 1; i < sorted.length; i++) {
    if (diffDays(sorted[i - 1], sorted[i]) > 2) break
    count++
  }
  return count
}

/**
 * 習慣ごとの週次ストリーク。週の達成回数が target 以上の週を連続で数える。
 * 今週は進行中なので、未達でも途切れさせない。
 */
export function calcWeeklyStreak(dates: string[], target: number, today: string): number {
  const counts = new Map<string, number>()
  for (const d of new Set(dates)) {
    const w = isoWeekStart(d)
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }

  let streak = 0
  let week = isoWeekStart(today)
  if ((counts.get(week) ?? 0) >= target) streak++

  week = addDays(week, -7)
  while ((counts.get(week) ?? 0) >= target) {
    streak++
    week = addDays(week, -7)
  }
  return streak
}
```

- [ ] **Step 6: テストが通ることを確認する**

```bash
npm test
```

Expected: 20 件すべて PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/date.ts src/lib/date.test.ts vitest.config.ts tests/stubs package.json package-lock.json
git commit -m "feat: JST と週境界と継続日数の計算を追加"
```

---

## Task 3: Better Auth による認証

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Modify: `prisma/schema.prisma`（Better Auth が追記する）
- Modify: `.env`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`
- Produces: `auth` from `@/lib/auth`（サーバー側）、`authClient` from `@/lib/auth-client`（クライアント側）

- [ ] **Step 1: 公式ドキュメントを読む**

**記憶で書かないこと。** 次を読んでから実装する。

- https://www.better-auth.com/docs/installation
- https://www.better-auth.com/docs/adapters/prisma
- https://www.better-auth.com/docs/integrations/next

確認すべき点:
1. `betterAuth()` に Prisma アダプタを渡す書き方と、`provider` に指定する値
2. メール+パスワードを有効にするオプション名
3. `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` など必要な環境変数
4. `[...all]/route.ts` で公開するハンドラの書き方（`toNextJsHandler` 等）
5. クライアント側 (`createAuthClient`) のインポート元

- [ ] **Step 2: パッケージを入れる**

```bash
npm install better-auth
npm install -D @better-auth/cli
```

- [ ] **Step 3: `.env` に秘密鍵を追加する**

```bash
node -e "console.log('BETTER_AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64url'))" >> .env
echo 'BETTER_AUTH_URL=http://localhost:3000' >> .env
```

- [ ] **Step 4: `src/lib/auth.ts` を書く**

Step 1 で読んだ手順に従う。メール+パスワードのみを有効にし、ソーシャルログインは設定しない。

- [ ] **Step 5: スキーマを生成する**

```bash
npx @better-auth/cli generate
```

Expected: `prisma/schema.prisma` に `User` / `Session` / `Account` / `Verification` が追記される

生成されるモデルは `@@map` で **小文字のテーブル名**に対応する（`user` / `session` / `account` / `verification`）。
raw SQL を書くときはこの名前を使う。**実測で確認済み。**

`User.name` は `String`（`String?` ではない）。表示名は必須項目になる。

生成モデルへの手作業は最小限にする。1.7.1 の CLI は既存のフィールドを保持してマージしたが
（`Schema was overwritten successfully!` と表示されても実際にはマージされる。実測で確認済み）、
これは公式に保証された挙動ではない。再生成のたびに `npx prisma validate` で確認する。

- [ ] **Step 6: Task 1 でコメントアウトしたリレーションを戻す**

`ShareLink.user` と `Habit.user` の `@relation` 行のコメントを外す。
生成された `User` モデルに、逆側のリレーション宣言を追記する。Prisma はリレーションを両側に書く必要があるため。

```prisma
  // User モデルに追記
  habits    Habit[]
  shareLink ShareLink?
```

（生成モデルへの追記はこの2行だけに留める。再生成後に残っているかを `prisma validate` で確認する。
消えていたら書き直す必要があるので、その旨をコメントで残す）

- [ ] **Step 7: 検証してマイグレーションする**

```bash
npx prisma validate
npx prisma migrate dev --name add_auth
npx prisma generate
```

`generate` を忘れると `User` 型が古いままになり、次のタスクで型エラーになる。

- [ ] **Step 8: Route Handler を作り、ここで一度コミットする**

`src/app/api/auth/[...all]/route.ts`。Step 1 で確認した書き方に従う。

画面がなくてもビルドとテストは通る。認証の基盤と画面は独立して意味が通るので、ここで区切る。

```bash
npm run lint && npm run build && npm test
git add prisma src/lib/auth.ts src/lib/auth-client.ts src/app/api package.json package-lock.json
git commit -m "feat: 認証の基盤を追加"
```

- [ ] **Step 9: 認証画面を作る**

`src/app/(auth)/layout.tsx` は中央寄せの最小限のレイアウト。Tailwind のデフォルトで十分。

`signup/page.tsx` は **表示名・メール・パスワード**の3つ。`login/page.tsx` はメールとパスワードの2つ。

`name` を省略できない。`/sign-up/email` の body スキーマは次のとおりで、`name` に `.optional()` が付いていない。

```js
// node_modules/better-auth/dist/api/routes/sign-up.mjs
const signUpEmailBodySchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string().nonempty(),
  ...
```

パスワードの既定は **8〜128 文字**（`node_modules/better-auth/dist/context/create-context.mjs`）。
短すぎる場合のエラーを画面に出す。**いずれも実測で確認済み。**

クライアント側から `authClient.signIn.email(...)` / `authClient.signUp.email(...)` を呼ぶ形になるはずだが、**正確な API は Step 1 のドキュメントで確認する。**
Better Auth のクライアント関数は `{ data, error }` を返す。`error` を握りつぶさず画面に出し、送信中はボタンを `disabled` にする。

- [ ] **Step 10: 実際に動かして確認する**

```bash
npm run dev
```

別のターミナルで:

```bash
playwright-cli open http://localhost:3000/signup
playwright-cli snapshot
```

次をすべて確認する。ログインを一度も通さずに完了扱いにしない。

1. 表示名・メール・パスワードで登録できる
2. パスワードを7文字にするとエラーメッセージが出る（例外画面にならない）
3. 登録後にログイン後の画面へ遷移し、セッション cookie が付いている
4. ログアウトできる
5. ログアウト後、同じメールとパスワードでログインし直せる
6. 誤ったパスワードではエラーメッセージが出る

```bash
docker exec diet-gacha-test-db psql -U postgres -d diet_gacha_test -tAc 'SELECT email, name FROM "user";'
```

Expected: 登録したメールアドレスと表示名が返る

- [ ] **Step 11: コミット**

```bash
git add src/app
git commit -m "feat: ログインと新規登録の画面を追加"
```

---

## Task 4: DAL の土台とログイン後のレイアウト

**Files:**
- Create: `src/data/session.ts`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/error.tsx`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`
- Produces:
  - `getSession(): Promise<Session | null>` — `cache()` で包む
  - `requireUser(): Promise<{ id: string }>` — 未ログインなら `redirect('/login')`

- [ ] **Step 1: `src/data/session.ts` を書く**

```ts
import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

/**
 * cache() で包むことで、1リクエスト内で何度呼んでも問い合わせは1回になる。
 * Server Component どうしで値を手渡しせずに済むため、
 * うっかり Client Component に渡す事故も防げる。
 */
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

/** 未ログインならログイン画面へ送る。データを取る関数はすべてこれを通す。 */
export async function requireUser(): Promise<{ id: string }> {
  const session = await getSession()
  if (!session?.user) redirect('/login')
  return { id: session.user.id }
}
```

`auth.api.getSession` の正確なシグネチャは Task 3 Step 1 のドキュメントで確認すること。

- [ ] **Step 2: `src/app/(app)/layout.tsx` を書く**

ヘッダーとナビゲーションだけ。**ここで認証チェックをしない。**

理由: Partial Rendering によりレイアウトは画面遷移で再レンダリングされず、セッションが毎回検証されない。またレイアウトは子ルートの実行を止められない。チェックは DAL 側で行う。

```tsx
import Link from 'next/link'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl p-4">
      <nav className="mb-6 flex gap-4 border-b pb-2">
        <Link href="/">今日</Link>
        <Link href="/habits">習慣</Link>
      </nav>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: 保護されていることを確認できる最小のページを書く**

`src/app/(app)/page.tsx`:

```tsx
import { requireUser } from '@/data/session'

export default async function TodayPage() {
  await requireUser()
  return <h1 className="text-xl font-bold">今日</h1>
}
```

あわせて `src/app/(app)/error.tsx` を作る。設計書は「想定外のエラーは例外を投げて `error.tsx` で受ける」方針なので、
これがないと計画したエラー体験にならない。Server Action の想定外例外もここに落ちる。

引数は Next.js 16 では `{ error, retry }`。15 系までの `reset` から変わっている
（`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`）。

```tsx
'use client'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">エラーが発生しました</h2>
      <button className="rounded border px-3 py-1" onClick={() => retry()}>
        もう一度試す
      </button>
    </div>
  )
}
```

`global-error.tsx` は第2弾に回す。ルートレイアウトが壊れる変更をこの計画では行わないため。

- [ ] **Step 4: 未ログインでリダイレクトされることを確認する**

```bash
npm run dev
```

```bash
playwright-cli open http://localhost:3000/ --headed
playwright-cli snapshot
```

Expected: `/login` に遷移している

- [ ] **Step 5: ログイン後に表示されることを確認する**

ログインしてから `/` を開き、「今日」が表示されることを確認する。

- [ ] **Step 6: コミット**

```bash
git add src/data/session.ts src/app
git commit -m "feat: DAL のセッション取得とログイン後のレイアウトを追加"
```

---

## Task 5: 習慣の登録・編集・削除

**Files:**
- Create: `src/data/habits.ts`
- Create: `src/app/(app)/habits/page.tsx`
- Create: `src/app/(app)/habits/actions.ts`
- Create: `src/app/(app)/habits/_components/habit-form.tsx`
- Create: `src/app/(app)/habits/_components/habit-list.tsx`
- Create: `src/lib/validate.ts`
- Create: `src/lib/validate.test.ts`

**Interfaces:**
- Consumes: `requireUser` from `@/data/session`、`prisma` from `@/lib/db`、`Weekday`
- Produces:
  - `listHabits(): Promise<HabitDTO[]>` — `HabitDTO = { id: string; name: string; daysOfWeek: Weekday[] }`
  - `createHabit(input: HabitInput): Promise<void>` — `HabitInput = { name: string; daysOfWeek: Weekday[] }`
  - `updateHabit(id: string, input: HabitInput): Promise<void>`
  - `archiveHabit(id: string): Promise<void>`
  - `validateHabit(input): { ok: true } | { ok: false; message: string }`
  - `parseWeekdays(values: string[]): Weekday[] | null` — allowlist に無い値が混ざれば `null`
  - `ActionResult = { ok: true } | { ok: false; message: string }`

- [ ] **Step 1: バリデーションの失敗するテストを書く**

`src/lib/validate.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseWeekdays, validateHabit } from './validate'

describe('validateHabit', () => {
  it('名前が空なら失敗', () => {
    const r = validateHabit({ name: '', daysOfWeek: ['MON'] })
    expect(r.ok).toBe(false)
  })
  it('名前が31文字なら失敗', () => {
    const r = validateHabit({ name: 'あ'.repeat(31), daysOfWeek: ['MON'] })
    expect(r.ok).toBe(false)
  })
  it('曜日が0個なら失敗', () => {
    const r = validateHabit({ name: '筋トレ', daysOfWeek: [] })
    expect(r.ok).toBe(false)
  })
  it('曜日が重複していたら失敗', () => {
    const r = validateHabit({ name: '筋トレ', daysOfWeek: ['MON', 'MON'] })
    expect(r.ok).toBe(false)
  })
  it('正しい入力なら成功', () => {
    const r = validateHabit({ name: '筋トレ', daysOfWeek: ['MON', 'WED', 'FRI'] })
    expect(r.ok).toBe(true)
  })
})

describe('parseWeekdays', () => {
  it('7つすべてを受け付ける', () => {
    const all = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
    expect(parseWeekdays(all)).toEqual(all)
  })
  it('allowlist に無い値があれば null', () => {
    expect(parseWeekdays(['MON', 'INVALID'])).toBeNull()
  })
  it('小文字は受け付けない', () => expect(parseWeekdays(['mon'])).toBeNull())
  it('空配列はそのまま返す（件数の検証は validateHabit の担当）', () => {
    expect(parseWeekdays([])).toEqual([])
  })
})
```

- [ ] **Step 2: 失敗を確認する**

```bash
npm test
```

Expected: FAIL

- [ ] **Step 3: `src/lib/validate.ts` を実装する**

```ts
import type { Weekday } from '@/generated/prisma/client'

export type ActionResult = { ok: true } | { ok: false; message: string }

export type HabitInput = { name: string; daysOfWeek: Weekday[] }

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

/**
 * FormData から来た文字列を Weekday に絞り込む。
 * TypeScript の cast は実行時に何も確かめないので、allowlist で照合する。
 * Server Action の引数は改変できるため、チェックボックスが正しくても検証は要る。
 */
export function parseWeekdays(values: string[]): Weekday[] | null {
  const allowed: readonly string[] = WEEKDAYS
  if (values.some((v) => !allowed.includes(v))) return null
  return values as Weekday[]
}

/** 作成と更新の両方から呼ぶ。検証はここ1箇所だけに置く。 */
export function validateHabit(input: HabitInput): ActionResult {
  const name = input.name.trim()
  if (name.length === 0) return { ok: false, message: '習慣の名前を入力してください' }
  if (name.length > 30) return { ok: false, message: '習慣の名前は30文字以内にしてください' }

  const days = input.daysOfWeek
  if (days.length === 0) return { ok: false, message: '実行する曜日を1つ以上選んでください' }
  if (new Set(days).size !== days.length) return { ok: false, message: '曜日が重複しています' }

  return { ok: true }
}
```

- [ ] **Step 4: テストが通ることを確認し、コミットする**

```bash
npm test
```

Expected: PASS

検証関数だけで単独に意味が通り、この時点でビルドもテストも通るので区切る。

```bash
git add src/lib/validate.ts src/lib/validate.test.ts
git commit -m "feat: 習慣の入力検証を追加"
```

- [ ] **Step 5: `src/data/habits.ts` を書く**

```ts
import 'server-only'

import { prisma } from '@/lib/db'
import { requireUser } from '@/data/session'
import { validateHabit, type ActionResult, type HabitInput } from '@/lib/validate'

/** 必要な項目だけを返す。Prisma のモデルをそのまま外へ出さない。 */
export async function listHabits() {
  const user = await requireUser()
  return prisma.habit.findMany({
    where: { userId: user.id, archivedAt: null },
    select: { id: true, name: true, daysOfWeek: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function createHabit(input: HabitInput): Promise<ActionResult> {
  const user = await requireUser()
  const v = validateHabit(input)
  if (!v.ok) return v

  await prisma.habit.create({
    data: { userId: user.id, name: input.name.trim(), daysOfWeek: input.daysOfWeek },
  })
  return { ok: true }
}

export async function updateHabit(id: string, input: HabitInput): Promise<ActionResult> {
  const user = await requireUser()
  const v = validateHabit(input)
  if (!v.ok) return v

  // userId で絞ることで、他人の習慣は 0 件になり更新されない。
  const r = await prisma.habit.updateMany({
    where: { id, userId: user.id, archivedAt: null },
    data: { name: input.name.trim(), daysOfWeek: input.daysOfWeek },
  })
  if (r.count === 0) return { ok: false, message: '操作できませんでした' }
  return { ok: true }
}

/** 物理削除しない。UserCard.viaHabitId が指す記録を失わせないため。 */
export async function archiveHabit(id: string): Promise<ActionResult> {
  const user = await requireUser()
  const r = await prisma.habit.updateMany({
    where: { id, userId: user.id, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (r.count === 0) return { ok: false, message: '操作できませんでした' }
  return { ok: true }
}
```

- [ ] **Step 6: Server Action を書く**

`src/app/(app)/habits/actions.ts`:

画面から DAL に到達する経路は3つ要る。作成・更新・アーカイブのすべてを書く。

```ts
'use server'

import { revalidatePath } from 'next/cache'
import * as habits from '@/data/habits'
import { parseWeekdays, type ActionResult } from '@/lib/validate'

/** FormData は信用しない。型が付いていても実行時には何でも入る。 */
function readInput(formData: FormData): { name: string; daysOfWeek: string[] } {
  return {
    name: String(formData.get('name') ?? ''),
    daysOfWeek: formData.getAll('daysOfWeek').map(String),
  }
}

export async function createHabitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const raw = readInput(formData)
  const daysOfWeek = parseWeekdays(raw.daysOfWeek)
  if (!daysOfWeek) return { ok: false, message: '実行する曜日の指定が不正です' }

  const result = await habits.createHabit({ name: raw.name, daysOfWeek })
  if (result.ok) revalidatePath('/habits')
  return result
}

export async function updateHabitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const id = String(formData.get('id') ?? '')
  if (id === '') return { ok: false, message: '操作できませんでした' }

  const raw = readInput(formData)
  const daysOfWeek = parseWeekdays(raw.daysOfWeek)
  if (!daysOfWeek) return { ok: false, message: '実行する曜日の指定が不正です' }

  const result = await habits.updateHabit(id, { name: raw.name, daysOfWeek })
  if (result.ok) revalidatePath('/habits')
  return result
}

export async function archiveHabitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const result = await habits.archiveHabit(String(formData.get('id') ?? ''))
  if (result.ok) revalidatePath('/habits')
  return result
}
```

アクションは入力の絞り込みと DAL の呼び出し、`revalidatePath` だけにする。認可とDB操作は `data/` 側にある。

`parseWeekdays` をアクション側に置くのは、DAL の引数の型が `Weekday[]` として成立していることを
入口で保証するため。`validateHabit`（件数・重複）は DAL の中で呼ぶので、検証が二重になるわけではない。

`archiveHabitAction` も失敗を捨てずに `ActionResult` を返す。無条件に `revalidatePath` して
何も伝えないと、他人の習慣を消そうとしたときにユーザーには「何も起きない」としか見えない。

- [ ] **Step 7: 画面を書く**

`_components/habit-form.tsx` は `'use client'`。`useActionState` でエラーメッセージを表示する。

**`useActionState` の正確なシグネチャは記憶で書かず、React 19 の公式ドキュメントで確認する。**
https://react.dev/reference/react/useActionState

曜日は7つのチェックボックス（`name="daysOfWeek"` `value="MON"` …）。既定はすべてオン。

`_components/habit-list.tsx` は Server Component でよい。週の目標回数は `daysOfWeek.length` で表示する（カラムには持たない）。
一覧の各行に「編集」と「削除」を置く。編集は `habit-form.tsx` を `defaultValue` 付きで再利用し、
`id` を `<input type="hidden" name="id">` で渡して `updateHabitAction` に送る。
削除も `useActionState(archiveHabitAction, null)` で受け、失敗時はメッセージを出す。

3つのアクションすべてで、`useActionState` の `isPending` の間は送信ボタンを `disabled` にする。二重送信を防ぐため。

編集で曜日を変えると過去の週次ストリークが計算し直される。フォームに1行注意書きを添える。

```
※ 曜日を変更すると、これまでの連続週数は計算し直されます
```

- [ ] **Step 8: `page.tsx` を書く**

```tsx
import { listHabits } from '@/data/habits'
import { HabitForm } from './_components/habit-form'
import { HabitList } from './_components/habit-list'

export default async function HabitsPage() {
  const habits = await listHabits()
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">習慣</h1>
      <HabitForm />
      <HabitList habits={habits} />
    </div>
  )
}
```

- [ ] **Step 9: 動かして確認する**

```bash
playwright-cli open http://localhost:3000/habits
```

確認すること:
1. 習慣を1つ登録できる
2. 名前を空で送信するとエラーメッセージが出る（例外画面にならない）
3. 曜日を全部外して送信するとエラーメッセージが出る
4. 名前と曜日を編集できる
5. 削除すると一覧から消える
6. DB では行が消えず `archivedAt` が入っている
7. 不正な曜日を直接送っても 5xx にならず、検証エラーが返る

7 はブラウザからは起こせないので、開発サーバーに対して直接投げて確かめる。
`parseWeekdays` を通さずに Prisma へ渡すと `PrismaClientValidationError`
（`code` を持たないので `P2002` 等の判定では拾えない）になり、`error.tsx` 行きになる。**実測で確認済み。**

```bash
docker exec diet-gacha-test-db psql -U postgres -d diet_gacha_test -tAc \
  'SELECT name, "archivedAt" FROM "Habit";'
```

- [ ] **Step 10: コミット**

```bash
git add src tests
git commit -m "feat: 習慣の登録・編集・削除を追加"
```

---

## Task 6: 達成のチェックとチケット発行

**Files:**
- Create: `src/data/checkins.ts`
- Create: `src/lib/errors.ts`
- Create: `src/app/(app)/actions.ts`
- Create: `src/app/(app)/_components/today-list.tsx`
- Modify: `src/app/(app)/page.tsx`
- Create: `tests/db/helpers.ts`
- Create: `tests/db/checkin.test.ts`

**Interfaces:**
- Consumes: `requireUser`、`prisma`、`jstDateString`、`calcStreak`、`calcWeeklyStreak`、`jstWeekday`
- Produces:
  - `getTodayView(): Promise<TodayView>`
    - `TodayView = { today: string; streak: number; ticketCount: number; habits: TodayHabit[] }`
    - `TodayHabit = { id: string; name: string; isToday: boolean; doneToday: boolean; weekDone: number; weekTarget: number; weeklyStreak: number }`
  - `checkInForUser(userId: string, habitId: string): Promise<ActionResult>` — DB 操作の本体。テストはこれを直接呼ぶ
  - `checkIn(habitId: string): Promise<ActionResult>` — `requireUser()` の結果を `checkInForUser` に渡すだけ
  - `checkInForUserWithRetry(userId: string, habitId: string): Promise<ActionResult>` — リトライ本体。テストはこれを直接呼ぶ
  - `checkInWithRetry(habitId: string): Promise<ActionResult>` — Server Action から呼ぶのはこれ
  - `NotAllowedError` / `isAlreadyCheckedIn` / `isDailySeqConflict` from `@/lib/errors`

- [ ] **Step 1: チケット発行の SQL を確認する**

「その日の件数 +1」で `dailySeq` を決めてはいけない。取り消しで穴が空いたとき（例: 1 と 3 が残る）、件数が2なので常に3を選び、既存の3と衝突し続けて無限にリトライする。

1〜3のうち**未使用の最小値**を選ぶ。

```sql
INSERT INTO "Ticket" ("id","userId","habitLogId","earnedDate","dailySeq")
SELECT $1, $2, $3, $4::date, s
FROM generate_series(1, 3) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "Ticket" t
  WHERE t."userId" = $2 AND t."earnedDate" = $4::date AND t."dailySeq" = s
)
ORDER BY s
LIMIT 1;
```

影響行数が 0 なら「その日は上限に達している」。エラーではなく正常系として扱い、チケットを発行しないまま成功を返す。

- [ ] **Step 2: `src/data/checkins.ts` の `checkInForUser` を書く**

セッションに依存する部分と DB 操作を最初から分ける。テストは `checkInForUser` を直接呼ぶ。

```ts
import 'server-only'

import { prisma } from '@/lib/db'
import { requireUser } from '@/data/session'
import { jstDateString } from '@/lib/date'
import { NotAllowedError, isAlreadyCheckedIn } from '@/lib/errors'
import type { ActionResult } from '@/lib/validate'

export async function checkInForUser(userId: string, habitId: string): Promise<ActionResult> {
  const today = jstDateString(new Date())

  try {
    await prisma.$transaction(async (tx) => {
      // 他人の習慣なら 0 件になり、複合外部キーにより HabitLog も作れない
      const habit = await tx.habit.findFirst({
        where: { id: habitId, userId, archivedAt: null },
        select: { id: true },
      })
      if (!habit) throw new NotAllowedError()

      const log = await tx.habitLog.create({
        data: { userId, habitId, date: new Date(`${today}T00:00:00Z`) },
        select: { id: true },
      })

      // 未使用の最小 dailySeq を選ぶ。0 行なら本日の上限。
      await tx.$executeRaw`
        INSERT INTO "Ticket" ("id","userId","habitLogId","earnedDate","dailySeq")
        SELECT gen_random_uuid()::text, ${userId}, ${log.id}, ${today}::date, s
        FROM generate_series(1, 3) AS s
        WHERE NOT EXISTS (
          SELECT 1 FROM "Ticket" t
          WHERE t."userId" = ${userId}
            AND t."earnedDate" = ${today}::date
            AND t."dailySeq" = s
        )
        ORDER BY s
        LIMIT 1
      `
    })
    return { ok: true }
  } catch (e) {
    if (isAlreadyCheckedIn(e)) return { ok: false, message: '今日はすでにチェック済みです' }
    if (e instanceof NotAllowedError) return { ok: false, message: '操作できませんでした' }
    throw e
  }
}

/** セッションを解決して checkInForUser に渡すだけ。 */
export async function checkIn(habitId: string): Promise<ActionResult> {
  const user = await requireUser()
  return checkInForUser(user.id, habitId)
}
```

- [ ] **Step 3: `src/lib/errors.ts` を書く**

**ここが計画のうち最も間違えやすい箇所である。** 一意制約違反の判定は、記憶ではなく実測した形に合わせる。

Prisma 7.9.1 + `@prisma/adapter-pg` + PostgreSQL 18 で実際に出る形は次のとおり（実測済み）。

```
code: 'P2002'                       ← Prisma API 経由（habitLog.create など）
code: 'P2010'                       ← $executeRaw 経由（Ticket の INSERT はこちら）
meta: {
  modelName: 'Ticket',              ← raw 経由では付かない
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '23505',
      kind: 'UniqueConstraintViolation',
      constraint: { fields: ['"userId"', '"earnedDate"', '"dailySeq"'] },
    },
  },
}
```

見落としやすい点が3つある。

1. **`meta.target` は存在しない。** driver adapter を使うと Rust エンジン経由の `target` は付かない。
   制約名の文字列と比較する実装は永久に一致せず、二重チェックも競合も全部 `error.tsx` 行きになる
2. **エラーコードが経路で変わる。** `Ticket` の INSERT は `$executeRaw` なので `P2002` ではなく `P2010` で来る。
   `code === 'P2002'` で絞ると dailySeq 競合を一生拾えない
3. **`constraint.fields` の引用符が不揃い。** 大文字を含む識別子だけ `"habitId"` のように引用符が付き、
   `date` や `email` は付かない。比較の前に剥がす

したがって、コードではなく **`kind` と列の組**で判定する。

```ts
import { Prisma } from '@/generated/prisma/client'

/** 他人のリソースを指したとき。DB には届かせない。 */
export class NotAllowedError extends Error {}

/**
 * 一意制約違反なら、違反した列名の配列を返す。そうでなければ null。
 * コード（P2002 / P2010）は経路で変わるので見ない。
 */
function uniqueViolationFields(e: unknown): string[] | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null
  const cause = (e.meta as { driverAdapterError?: { cause?: Record<string, unknown> } })
    ?.driverAdapterError?.cause
  if (cause?.kind !== 'UniqueConstraintViolation') return null

  const fields = (cause.constraint as { fields?: unknown } | undefined)?.fields
  if (!Array.isArray(fields)) return null
  return fields.map((f) => String(f).replaceAll('"', ''))
}

function violates(e: unknown, expected: string[]): boolean {
  const fields = uniqueViolationFields(e)
  if (!fields) return false
  return fields.length === expected.length && expected.every((f) => fields.includes(f))
}

/** HabitLog(habitId, date) — 同じ習慣を同じ日に2回。ユーザーへの通常のエラー。 */
export const isAlreadyCheckedIn = (e: unknown) => violates(e, ['habitId', 'date'])

/** Ticket(userId, earnedDate, dailySeq) — 並行実行で同じ枠を取り合った。リトライ対象。 */
export const isDailySeqConflict = (e: unknown) => violates(e, ['userId', 'earnedDate', 'dailySeq'])
```

`instanceof Prisma.PrismaClientKnownRequestError` は生成 Client の `Prisma` 名前空間から取れる。
実際に true を返すことを確認済み。

この形は Prisma が公開契約として文書化しているものではない。**Step 6 で形状を固定するテストを必ず書く。**
Prisma を上げたときに壊れたら、そのテストが先に落ちる。

- [ ] **Step 4: リトライをトランザクションの外に置く**

PostgreSQL では一意制約違反が起きた時点でトランザクション全体がアボート状態になり、内側では回復できない。丸ごとやり直す。

リトライ本体も `userId` を受ける形にする。DB テストから直接呼べないと、リトライ経路を一度も検証できないため。

```ts
export async function checkInForUserWithRetry(
  userId: string,
  habitId: string,
): Promise<ActionResult> {
  for (let i = 0; i < 3; i++) {
    try {
      return await checkInForUser(userId, habitId)
    } catch (e) {
      if (!isDailySeqConflict(e)) throw e
    }
  }
  return { ok: false, message: 'しばらく待ってからもう一度お試しください' }
}

export async function checkInWithRetry(habitId: string): Promise<ActionResult> {
  const user = await requireUser()
  return checkInForUserWithRetry(user.id, habitId)
}
```

`isDailySeqConflict` は Step 3 のとおり、列の組が `(userId, earnedDate, dailySeq)` のときだけ true を返す。

- [ ] **Step 5: 実 DB を使うテストのヘルパーを書く**

`tests/db/helpers.ts`:

**Better Auth のテーブルも消す。** `Habit` は `user` を参照する側なので、
アプリ側のテーブルを `CASCADE` で TRUNCATE しても `user` の行は残る。実測すると1行残り、
2回目の `npm test` は固定 email の一意制約違反（`P2010`）で落ちる。

```ts
import { prisma } from '@/lib/db'

/**
 * テスト間で状態を持ち越さない。
 * TRUNCATE ... CASCADE が波及するのは「参照している側」なので、
 * user を消さない限り2回目の実行で email が衝突する。
 * テーブル名は Better Auth の生成結果（@@map による小文字）に合わせる。
 */
export async function resetDb() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "UserCard", "GachaResult", "Ticket", "HabitLog", "Habit", "ShareLink",
      "user", "session", "account", "verification"
    RESTART IDENTITY CASCADE
  `)
}

export async function createUser(email: string) {
  const id = crypto.randomUUID()
  await prisma.$executeRawUnsafe(
    `INSERT INTO "user" (id, email, name, "emailVerified", "createdAt", "updatedAt")
     VALUES ($1, $2, $2, false, now(), now())`,
    id, email,
  )
  return { id }
}
```

DB テストは今は1ファイルなので、Vitest の既定の並列実行でも問題は起きない。
**ファイルが2つ目になった時点で**、同じ DB を並列に TRUNCATE し合うので
`test.fileParallelism: false` か、DB テスト専用の config への分離が要る。
先回りはしない。増やすときにこの段落を読む。

- [ ] **Step 6: 失敗するテストを書く**

`tests/db/checkin.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { resetDb, createUser } from './helpers'

describe('チケット発行', () => {
  beforeEach(resetDb)

  it('1日に4件達成してもチケットは3枚で止まる', async () => {
    const user = await createUser('a@example.com')
    const habitIds: string[] = []
    for (let i = 0; i < 4; i++) {
      const h = await prisma.habit.create({
        data: { userId: user.id, name: `h${i}`, daysOfWeek: ['MON'] },
        select: { id: true },
      })
      habitIds.push(h.id)
    }

    for (const id of habitIds) await checkInAs(user.id, id)

    const count = await prisma.ticket.count({ where: { userId: user.id } })
    expect(count).toBe(3)
  })

  it('取り消して再チェックしても dailySeq が衝突しない', async () => {
    const user = await createUser('b@example.com')
    const ids = await createHabits(user.id, 4)

    for (const id of ids.slice(0, 3)) await checkInAs(user.id, id)
    await undoCheckInAs(user.id, ids[1])
    const r = await checkInAs(user.id, ids[3])

    expect(r.ok).toBe(true)
    const seqs = await prisma.ticket.findMany({
      where: { userId: user.id },
      select: { dailySeq: true },
      orderBy: { dailySeq: 'asc' },
    })
    expect(seqs.map((s) => s.dailySeq)).toEqual([1, 2, 3])
  })

  it('同じ習慣を並行して2回チェックしてもチケットは1枚', async () => {
    const user = await createUser('c@example.com')
    const [id] = await createHabits(user.id, 1)

    await Promise.allSettled([checkInAs(user.id, id), checkInAs(user.id, id)])

    expect(await prisma.ticket.count({ where: { userId: user.id } })).toBe(1)
    expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(1)
  })

  // 上のテストは HabitLog(habitId,date) の競合であって、dailySeq の競合ではない。
  // リトライ経路を通すには、異なる2習慣が同じ空き枠を同時に取りに行く必要がある。
  it('異なる2習慣を並行チェックすると両方成功し dailySeq が 1 と 2 になる', async () => {
    for (let trial = 0; trial < 5; trial++) {
      await resetDb()
      const user = await createUser('e@example.com')
      const [a, b] = await createHabits(user.id, 2)

      const rs = await Promise.all([
        checkInWithRetryAs(user.id, a),
        checkInWithRetryAs(user.id, b),
      ])

      expect(rs.every((r) => r.ok)).toBe(true)
      expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(2)
      const seqs = await prisma.ticket.findMany({
        where: { userId: user.id },
        select: { dailySeq: true },
        orderBy: { dailySeq: 'asc' },
      })
      expect(seqs.map((s) => s.dailySeq)).toEqual([1, 2])
    }
  })
})

// エラー判定が壊れたら、業務ロジックのテストより先にここが落ちるようにする。
// Prisma を上げたときに meta の形が変わっても気づける。
describe('一意制約違反の形状', () => {
  beforeEach(resetDb)

  it('Prisma API 経由の HabitLog 衝突を isAlreadyCheckedIn が拾う', async () => {
    const user = await createUser('f@example.com')
    const [id] = await createHabits(user.id, 1)
    await checkInAs(user.id, id)

    const r = await checkInAs(user.id, id)
    expect(r).toEqual({ ok: false, message: '今日はすでにチェック済みです' })
  })

  it('raw SQL 経由の Ticket 衝突を isDailySeqConflict が拾い、isAlreadyCheckedIn は拾わない', async () => {
    const user = await createUser('g@example.com')
    const [id] = await createHabits(user.id, 1)
    await checkInAs(user.id, id)

    // 同じ (userId, earnedDate, dailySeq) をもう一度入れて衝突させる
    const err = await captureError(() => insertDuplicateTicket(user.id))

    expect(isDailySeqConflict(err)).toBe(true)
    expect(isAlreadyCheckedIn(err)).toBe(false)
  })
})
```

`checkInAs` / `checkInWithRetryAs` / `undoCheckInAs` / `createHabits` / `captureError` /
`insertDuplicateTicket` はテスト用のヘルパー。`checkInAs` は `checkInForUser` を、
`checkInWithRetryAs` は `checkInForUserWithRetry` を、そのまま呼ぶだけでよい。

並行テストは `Promise.all` のタイミング任せなので、単発だと競合が起きないまま PASS しうる。
5回反復して、少なくとも一度は実際にリトライが走ることを狙う。
それでも不安定なら、リトライ回数を数えるカウンタをテスト時だけ観測する形に変える。

- [ ] **Step 7: 失敗を確認する**

```bash
docker compose up -d
npm test
```

Expected: FAIL

- [ ] **Step 8: 通るまで実装する**

Step 2〜4 の `checkInForUser` / `checkInForUserWithRetry` と `src/lib/errors.ts` を実装する。
`undoCheckInForUser` は Task 7 で書くので、ここではテストのうち取り消しを使うものを skip にしておくか、
Task 7 まで書かない。**赤いテストをコミットしないこと。**

- [ ] **Step 9: テストが通ることを確認し、コミットする**

```bash
npm test
```

Expected: すべて PASS

DB コンテナを落とさずに2回続けて実行し、2回目も通ることを確認する。`resetDb` の抜けはここで出る。

```bash
npm test && npm test
```

並行チェックのテストは不安定になりやすい。落ちる場合は `Promise.all` の両方が
本当に同時に走っているかを確認する。片方が先に完了していると競合が再現しない。

DAL とテストだけで単独に意味が通るので、画面の前で区切る。

```bash
npm run lint && npm run build
git add src/data/checkins.ts src/lib/errors.ts tests
git commit -m "feat: 達成のチェックとチケット発行を追加"
```

- [ ] **Step 10: `getTodayView` を書く**

```ts
export async function getTodayView() {
  const user = await requireUser()
  const today = jstDateString(new Date())
  const todayWeekday = jstWeekday(today)

  const [habits, logs, ticketCount] = await Promise.all([
    prisma.habit.findMany({
      where: { userId: user.id, archivedAt: null },
      select: { id: true, name: true, daysOfWeek: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.habitLog.findMany({
      where: { userId: user.id },
      select: { habitId: true, date: true },
    }),
    prisma.ticket.count({ where: { userId: user.id, consumedAt: null } }),
  ])

  // DB の date 型は UTC 0時の Date として返るので、'YYYY-MM-DD' に揃えてから純粋関数に渡す
  const allDates = logs.map((l) => l.date.toISOString().slice(0, 10))
  const doneToday = new Set(
    logs.filter((l) => l.date.toISOString().slice(0, 10) === today).map((l) => l.habitId),
  )

  return {
    today,
    streak: calcStreak(allDates, today),
    ticketCount,
    habits: habits.map((h) => {
      const dates = logs
        .filter((l) => l.habitId === h.id)
        .map((l) => l.date.toISOString().slice(0, 10))
      const thisWeek = isoWeekStart(today)
      return {
        id: h.id,
        name: h.name,
        isToday: h.daysOfWeek.includes(todayWeekday),
        doneToday: doneToday.has(h.id),
        weekDone: dates.filter((d) => isoWeekStart(d) === thisWeek).length,
        weekTarget: h.daysOfWeek.length,
        weeklyStreak: calcWeeklyStreak(dates, h.daysOfWeek.length, today),
      }
    }),
  }
}
```

3つのクエリは互いに独立しているので `Promise.all` で並行に投げる。順番に `await` すると待ち時間が積み上がる。

週の目標回数は `daysOfWeek.length` から求める。カラムには持たない。

- [ ] **Step 11: Server Action を書く**

`src/app/(app)/actions.ts`。画面から DAL に到達する経路がないと、チェックはボタンを置いても動かない。

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { checkInWithRetry } from '@/data/checkins'
import type { ActionResult } from '@/lib/validate'

export async function checkInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const habitId = String(formData.get('habitId') ?? '')
  if (habitId === '') return { ok: false, message: '操作できませんでした' }

  const result = await checkInWithRetry(habitId)
  if (result.ok) revalidatePath('/')
  return result
}
```

Server Action は公開 API と同じ入口として扱う。`habitId` を信用せず、
認可は `checkInForUser` の中の `where: { id, userId }` で行う
（`node_modules/next/dist/docs/` の data security の指針、および設計書「認可は DAL に集約する」）。

- [ ] **Step 12: 画面を書いて動かす**

`_components/today-list.tsx` に、今日が対象の習慣を上に、それ以外を下に表示する。
各行のチェックは `useActionState(checkInAction, null)` で受け、`isPending` の間はボタンを `disabled` にする。
失敗時（すでにチェック済み、上限到達）はその行にメッセージを出す。
各行に「今週 2/3」と「3週連続」を出す。ヘッダーに継続日数とチケット残高。

継続日数の下に1行添える。

```
1日空いても途切れません
```

- [ ] **Step 13: 手で確認する**

```bash
playwright-cli open http://localhost:3000/
```

1. 習慣をチェックするとチケットが増える
2. 4件目をチェックしてもチケットが増えない（エラー画面にならず、正常に「増えない」）
3. ボタンを連打しても二重に増えない
4. すでにチェック済みの習慣をもう一度チェックすると、メッセージが出る（`error.tsx` に飛ばない）

- [ ] **Step 14: コミット**

```bash
git add src
git commit -m "feat: 今日の画面を追加"
```

---

## Task 7: 誤チェックの取り消し

**Files:**
- Modify: `src/data/checkins.ts`
- Modify: `src/app/(app)/actions.ts`
- Modify: `src/app/(app)/_components/today-list.tsx`
- Modify: `tests/db/checkin.test.ts`

**Interfaces:**
- Produces:
  - `undoCheckInForUser(userId: string, habitId: string): Promise<ActionResult>` — DB 操作の本体。テストはこれを直接呼ぶ
  - `undoCheckIn(habitId: string): Promise<ActionResult>` — `requireUser()` の結果を渡すだけ
  - `undoCheckInAction(prevState, formData): Promise<ActionResult>`

- [ ] **Step 1: 失敗するテストを追加する**

```ts
it('未消費チケットが紐づくチェックは取り消せる', async () => {
  const user = await createUser('d@example.com')
  const [id] = await createHabits(user.id, 1)
  await checkInAs(user.id, id)

  const r = await undoCheckInAs(user.id, id)

  expect(r.ok).toBe(true)
  expect(await prisma.habitLog.count({ where: { userId: user.id } })).toBe(0)
  expect(await prisma.ticket.count({ where: { userId: user.id } })).toBe(0)
})
```

消費済みチケットが紐づく場合のテストは、ガチャが未実装のため第2弾の計画で追加する。

- [ ] **Step 2: 失敗を確認する**

```bash
npm test
```

- [ ] **Step 3: 実装する**

`Ticket → HabitLog` は `Restrict` なので、Ticket を先に消す。
消費済み（`GachaResult` が存在する）チケットは `GachaResult → Ticket` の `Restrict` により削除がブロックされる。
DB 側でも守られるが、アプリ側でも事前に判定して意味のあるエラーを返す。

```ts
export async function undoCheckInForUser(userId: string, habitId: string): Promise<ActionResult> {
  const today = jstDateString(new Date())

  return prisma.$transaction(async (tx) => {
    const log = await tx.habitLog.findFirst({
      where: { userId, habitId, date: new Date(`${today}T00:00:00Z`) },
      select: { id: true, ticket: { select: { id: true, consumedAt: true } } },
    })
    if (!log) return { ok: false, message: '取り消せる記録がありません' }
    if (log.ticket?.consumedAt) {
      return { ok: false, message: 'このチケットは使用済みのため取り消せません' }
    }

    if (log.ticket) await tx.ticket.delete({ where: { id: log.ticket.id } })
    await tx.habitLog.delete({ where: { id: log.id } })
    return { ok: true }
  })
}
```

- [ ] **Step 4: テストが通ることを確認する**

```bash
npm test
```

Expected: すべて PASS

- [ ] **Step 5: Server Action を足して、画面にボタンを出す**

`src/app/(app)/actions.ts` に追加する。

```ts
export async function undoCheckInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const habitId = String(formData.get('habitId') ?? '')
  if (habitId === '') return { ok: false, message: '操作できませんでした' }

  const result = await undoCheckIn(habitId)
  if (result.ok) revalidatePath('/')
  return result
}
```

チェック済みの行に「取り消す」を出す。`useActionState(undoCheckInAction, null)` で受け、
`isPending` の間は `disabled`。「取り消せる記録がありません」「使用済みのため取り消せません」を
その行に表示する。どちらも想定内の失敗なので `error.tsx` に飛ばさない。

- [ ] **Step 6: 手で確認する**

チェック → 取り消し → 再チェックを行い、`dailySeq` が 1〜3 に収まっていることを確認する。

```bash
docker exec diet-gacha-test-db psql -U postgres -d diet_gacha_test -tAc \
  'SELECT "dailySeq" FROM "Ticket" ORDER BY "dailySeq";'
```

- [ ] **Step 7: コミット**

```bash
git add src tests
git commit -m "feat: 誤チェックの取り消しを追加"
```

---

## 完了条件

- [ ] `npm run lint` が通る
- [ ] `npm run build` が通る
- [ ] `npm test` がすべて通る
- [ ] 生成物を消した状態から `rm -rf src/generated && npm ci && npm run build` が通る
- [ ] ログイン → 習慣を登録 → チェック → チケットが増える、が動く
- [ ] 1日3枚を超えない
- [ ] 取り消して再チェックしても壊れない

### 実装で塞いだと確認すること

- [ ] signup に表示名を入れて登録でき、ログアウト後に同じ資格情報でログインし直せる
- [ ] 不正な曜日文字列を Server Action に送っても 5xx にならず、検証エラーが返る
- [ ] 習慣を編集でき、更新の失敗が画面に表示される
- [ ] `checkInAction` / `undoCheckInAction` が存在し、想定内の失敗を画面に返す
- [ ] DB コンテナを維持したまま `npm test` を2回連続で実行して通る
- [ ] 異なる2習慣の並行チェックで dailySeq 競合がリトライされ、両方成功する
- [ ] 一意制約違反の形状を固定するテストがあり、`isAlreadyCheckedIn` と `isDailySeqConflict` を取り違えない

## 実測で確認済みの前提

次は 2026-08-22 に、実際のパッケージと PostgreSQL 18 コンテナで動かして確認した。
記憶や公式ドキュメントの記述ではなく、実行結果である。

| 事実 | 影響する箇所 |
|---|---|
| `prisma migrate dev` は Prisma Client を生成しない（`--help` の記述に反する） | Task 1, 3 |
| `prisma-client` generator の出力は TypeScript。素の `node` からは読めない | Task 1, 2 |
| `prisma migrate dev` は必要時に TTY を要求し、非対話環境では失敗する | Global Constraints |
| `server-only` は非 `react-server` 条件で即 throw する。Vitest は alias が要る | Task 2 |
| P2002 の `meta` に `target` は無い。`driverAdapterError.cause.constraint.fields` を見る | Task 6 |
| `$executeRaw` 経由の一意制約違反は `P2002` ではなく `P2010` | Task 6 |
| `constraint.fields` は大文字を含む識別子だけ引用符付き | Task 6 |
| `instanceof Prisma.PrismaClientKnownRequestError` は成立する | Task 6 |
| アプリ側テーブルの `TRUNCATE ... CASCADE` は `user` に波及しない | Task 6 |
| Better Auth 1.7.1 の `/sign-up/email` は `name` 必須。パスワードは既定 8〜128 文字 | Task 3 |
| Better Auth の生成テーブル名は `@@map` で小文字（`user` 等）。`User.name` は必須 | Task 3, 6 |
| `@better-auth/cli generate` は手で足したリレーションを保持した（保証はされていない） | Task 3 |
| 不正な enum 値は `PrismaClientValidationError`。`code` を持たない | Task 5 |
| Next.js 16 の `error.tsx` の引数は `{ error, retry }` | Task 4 |

## この計画で確認せずに書いた箇所（実装時に必ず検証する）

| 箇所 | 理由 |
|---|---|
| Better Auth の設定（`betterAuth()` の引数、環境変数名） | 公式ドキュメントを読んでから書く（Task 3 Step 1） |
| `useActionState` のシグネチャ | React 19 の公式ドキュメントで確認する |
| `@prisma/adapter-pg` のエクスポート名 | 型定義を開いて確認する |
| `prisma.config.ts` の正確なフィールド | 公式ドキュメントで確認する |
| `driverAdapterError.cause` の形が Prisma のバージョン間で安定するか | 公開契約として文書化されていない。Task 6 Step 6 のテストで固定する |

`src/lib/date.ts` と一連のテスト、`dailySeq` の SQL、スキーマは**実際に動かして確認済み**。
