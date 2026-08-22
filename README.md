# diet-gacha

自分で決めた小さな習慣を達成するとチケットが貯まり、ガチャを引いてカードを集めるアプリ。
TypeScript と Next.js を習得するための個人プロジェクト。

設計の詳細と判断の根拠は `docs/superpowers/specs/2026-08-21-architecture-design.md` にある。
プロジェクトの規約は `AGENTS.md` を参照。

## 初回セットアップ

```bash
git config core.hooksPath .githooks

cp .env.example .env
# .env の BETTER_AUTH_SECRET を埋める
openssl rand -base64 32

docker compose up -d
npx prisma migrate deploy

npm run dev
```

`DATABASE_URL` は `.env.example` の既定値（`docker compose up -d` が起動するテスト DB）のままでよい。

## 検証コマンド

| 目的 | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| 静的検査 | `npm run lint` |
| ビルド | `npm run build` |
| テスト | `npm test` |
| テスト DB の起動 | `docker compose up -d` |
| テスト DB の破棄 | `docker compose down -v` |

`tests/db/` のテストは実 DB を使う。実行前に `docker compose up -d` が要る。

## デプロイ手順

Vercel + Neon Postgres を想定している。

1. Neon に DB を作る
2. Vercel のプロジェクトに `DATABASE_URL` と `BETTER_AUTH_SECRET` を設定する
3. ローカルから、Neon の**ダイレクト接続**（プール接続の `-pooler` ではない方）の URL でマイグレーションを当てる

   ```bash
   DATABASE_URL=<Neon のダイレクト接続 URL> npx prisma migrate deploy
   ```

4. デプロイする

Neon はプール接続（`-pooler` が付く URL）とダイレクト接続で URL が異なり、マイグレーションはダイレクト接続側に当てる必要がある。

マイグレーションを自動化していない理由: `build` に `prisma migrate deploy` を組み込むと、プレビューデプロイのたびに本番 DB にマイグレーションが当たってしまう。個人プロジェクトでデプロイ頻度が低いため、手動運用で十分と判断した。

`BETTER_AUTH_URL` は未設定でもリクエストの origin にフォールバックするため、Vercel では設定しなくても動く。ただしプレビュー URL ごとに origin が変わるので、本番はカスタムドメインを明示設定し、プレビューでは未設定にするのが安定する。

## 技術選定

| 層 | 選定 | なぜそれを選んだか | 他に何を検討したか |
|---|---|---|---|
| ORM | Prisma 7.9.1 | 宣言的スキーマとマイグレーション生成の流れに慣れているため | Drizzle ORM。`latest` は 0.45.2 で v1 は RC 段階（rc.4）。開発期間中に破壊的変更が入りうると判断して避けた |
| 認証 | Better Auth 1.7.1 | Auth.js の後継として公式に指名されている。セッションとユーザーを自前 DB に持てる | Auth.js（v5 が長期間ベータで、2025-09-22 以降は移管先の Better Auth チームがセキュリティ修正のみ行う体制）。Clerk・Supabase Auth は認証が外部サービス側に閉じてしまう |
| テスト | Vitest | Vite ベースで TypeScript のトランスパイルがそのまま通る。Next.js の推奨からも外れない | — |
| データアクセス | `src/data/` への DAL 一本化。レイヤー分割・DI は不採用 | 保護すべきロジックは抽選・ストリーク計算・日付境界の3つで、いずれも DB に依存しない純粋関数として `src/lib/` に切り出せる。Repository インターフェースを導入すると、トランザクションのクライアントを全 Repository に引き回す必要が生じ、「DB に依存しないための仕組み」が DB の都合で歪む | Repository パターンによるレイヤー分割。この規模（画面7つ）では境界が二重になるだけで、実利がないと判断した |
| 集計値の持ち方 | チケット残高・ストリーク・週の目標回数はカラムに持たず都度計算する | 更新経路が増えるたびに整合性を保つ箇所が増える。習慣の登録件数の規模では都度計算のコストは無視できる | カラムにキャッシュしてバッチや trigger で更新する方式。書き込み経路が複数（チェック・取り消し・アーカイブ）あり、同期漏れのリスクが計算コストより大きいと判断した |

詳しい理由と検討過程は `docs/superpowers/specs/2026-08-21-architecture-design.md` の「4. 技術選定」「6. アーキテクチャ方針」を参照。
