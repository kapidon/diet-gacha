<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# diet-gacha

自分で決めた小さな習慣を達成するとチケットが貯まり、ガチャを引いてカードを集めるアプリ。
TypeScript と Next.js を習得するための個人プロジェクト。

設計の詳細と判断の根拠は `docs/superpowers/specs/2026-08-21-architecture-design.md` にある。
仕様に関する判断は、この文書を参照してから行う。

このファイルは Claude Code と Codex の両方が読む。エージェントに依存しない規約はここに書く。
Claude Code にだけ必要な指示は `CLAUDE.md` に置く。
上の管理ブロックは `next dev` が書き換える。**マーカーの内側は編集しない**（外側は保持される）。

## スコープ

第1弾で実装するのは以下だけ。これ以外の機能は提案も実装もしない。

- ユーザー登録・ログイン
- 習慣の登録・編集・削除（実行曜日の指定を含む）
- 日々の達成チェック
- チケット付与（1達成1枚、1日3枚上限）
- ガチャ（全ランダム、サーバー側抽選）
- 図鑑（カード40枚）とご褒美の紐付け
- ストリーク（全体・習慣ごと）
- 達成状況の推移表示
- 図鑑の公開ページと OG 画像

第2弾以降に回すもの（設計では塞がないが実装しない）:

- カード裏面の知識・出典、カード画像、ジャンル、保有率・発見順位の表示、月次まとめ

実装しないと決めたもの:

- 体重・食事内容の記録
- ユーザーによる景品の追加・編集
- ストリーク断絶時のペナルティ

## 技術選定の方針

- 必須要件を満たすために不要なライブラリを追加しない。追加が必要なときは、理由と代替案を示して承認を得てから入れる
- 「一般的にはこうする」ではなく「この規模ならこれで十分」を優先する
- 抽象化・共通化は、同じ重複が3回以上出てから検討する。先回りしない
- パフォーマンス最適化は、計測して問題が出てから行う

採用しないもの:

- 状態管理ライブラリ（`useState` / `useContext` で足りる範囲に留める）
- レイヤー分割やDIの導入
- モノレポ構成
- 独自の型ユーティリティやジェネリクスの多用

## コード

- Next.js 公式ドキュメントに沿った標準的な書き方をする
- 読めば分かるコードを優先する
- UI は Tailwind のデフォルトで十分。装飾に凝らない

## アーキテクチャ

- データアクセスは `src/data/` の DAL に一本化する。`page.tsx` から Prisma を直接呼ばない
- DAL は `import 'server-only'` を付け、認可チェックを行い、必要な項目だけを返す
- Server Action は薄くする。DB 操作と認可は DAL に置き、アクションは呼び出しと `revalidatePath` のみ
- Route Handler は Better Auth の `/api/auth/[...all]` だけ。`proxy.ts` は作らない
- 集計で求まる値（チケット残高、ストリーク、週の目標回数）はカラムに持たない
- 抽選・日付・週境界の計算は `src/lib/` の純粋関数として、DB から切り離す

## 検証

Node.js は `.node-version` の `24.19.0` を使う。fnm が `cd` で切り替える。

| 目的 | コマンド |
|---|---|
| 開発サーバー | `npm run dev` |
| 静的検査 | `npm run lint` |
| ビルド | `npm run build` |
| テスト | `npm test` |
| テスト DB の起動 | `docker compose up -d` |
| テスト DB の破棄 | `docker compose down -v` |

- `tests/db/` のテストは実 DB を使う。実行前に `docker compose up -d` が要る
- 変更範囲に応じて必要なものだけ実行し、**実行していない項目は報告に明記する**
- `test` script は基盤実装計画の Task 2 で追加する。それ以前のコミットは `npm run lint && npm run build` を満たせばよい

## 既知の落とし穴

2026-08-22 と 2026-08-24 に、実際のパッケージと PostgreSQL 18 コンテナで動かして確認した事実。
記憶や公式ドキュメントの記述より、こちらを優先する。矛盾を見つけたら計測し直して、ここを直す。

- **`prisma migrate dev` は Prisma Client を生成しない。** `--help` の "trigger generators" に反するが、
  7.9.1 では生成されない。スキーマを変えたら `npx prisma generate` を続けて実行する
- **`prisma-client` generator の出力は TypeScript。** 素の `node` からは import できない。
  Next.js か Vitest のトランスパイルを通す
- **`prisma migrate dev` は必要時に TTY を要求し、非対話環境では失敗する。**
  プロンプトを出さない経路があるので、まずそれを通す。
  `npx prisma migrate dev --create-only --name <名前>` で SQL を生成し、
  **生成された `migration.sql` を全文読んで** `DROP` / `TRUNCATE` / 既存列の型変更が無いことを確認してから、
  `npx prisma migrate deploy` で適用する（`deploy` はプロンプトを出さない）。続けて `npx prisma generate`。
  破壊的な SQL が出たとき、`--create-only` 自体がプロンプトを要求したときは、人間に渡す
- **`server-only` は Vitest では即 throw する。** `react-server` 条件でのみ空モジュールになる marker package なので、
  DAL をテストから import するには `vitest.config.mts` で空モジュールへ alias する
- **一意制約違反に `meta.target` は無い。** driver adapter 経由では
  `meta.driverAdapterError.cause.constraint.fields` に列名が入る。大文字を含む識別子だけ引用符付き。
  さらに `$executeRaw` 経由では `P2002` ではなく **`P2010`** で来るため、コードで絞ってはいけない。
  判定は `cause.kind === 'UniqueConstraintViolation'` と列の組で行う
- **enum に不正な値を渡すと `PrismaClientValidationError`。** `code` を持たないので `P2002` 等の判定では拾えない。
  `FormData` の値は allowlist で実行時に絞り込む
- **`TRUNCATE ... CASCADE` は参照している側にしか波及しない。** アプリ側のテーブルを消しても `user` は残る
- **Better Auth の生成テーブル名は `@@map` で小文字**（`user` / `session` / `account` / `verification`）。
  `/sign-up/email` は `name` が必須で、パスワードの既定は 8〜128 文字
- **Next.js 16 の `error.tsx` の引数は `{ error, retry }`。** 15 系までの `reset` から変わっている
- **`prisma generate` は `DATABASE_URL` を要求する。** `prisma.config.ts` の `env('DATABASE_URL')` が
  読み込み時に解決されるため。`postinstall` に置いてあるので、**`.env` が無いと `npm ci` 自体が失敗する**。
  clone 直後は `.env.example` から `.env` を作る。CI では job の環境変数で渡す
- **`@prisma/client` 自身が `prisma` に依存している。** `prisma` を devDependencies に移しても
  `npm audit --omit=dev` の対象から外れない。`npm ls prisma --omit=dev` で経路が見える。
  `@prisma/config` 経由の `deepmerge-ts` に high の advisory があり、
  `npm audit fix` の提案は Prisma 6 へのダウングレードだけなので、7 を使う限り解消できない。
  CI の `npm audit` は `--audit-level=critical` で通している
- **ESLint は `.claude/worktrees/` の複製まで検査する。** 本体を二重に検査して1万件以上の指摘が出る。
  `eslint.config.mjs` の `globalIgnores` で `.claude/**` と `src/generated/**` を外してある
- **依存の取得は Takumi Guard のプロキシ（`npm.flatt.tech`）を通す。** `.npmrc` で指定してある。
  `npm ci` は `package-lock.json` の `resolved` URL をそのまま使うので、
  **`.npmrc` を変えるだけでは経路が変わらない**。lock 側の URL も揃っている必要がある。
  切り替えたときは `sed` で `resolved` を一括置換した（711 件）。integrity は tarball の
  内容ハッシュなので、プロキシが同じものを返す限り一致する（実際に `npm ci` で検証済み）

## 進め方

- 新しい概念や記法を導入するときは、コードを書く前に説明する
- 機能を実装したら、README 用に「何を選んだか」「なぜそれを選んだか」「他に何を検討して、なぜ採用しなかったか」を短くまとめる

## レビューしやすく提示する

提案・設計・実装を提示するときは、末尾に次を書く。該当がなければ「なし」と明記する。

- **判断が必要なこと** — 好みや要件に属し、ユーザーにしか決められないもの
- **確信が持てていない箇所** — 推測で書いた部分、未検証の部分
- **後から変えるコストが高い決定** — 間違えると作り直しになるもの
- **検証状況** — 実際に動かして確認したことと、していないこと

「問題ないですか」で終わらせない。どこをどう見ればよいかを示す。
一般論ではなく、その提案に固有の箇所を挙げる。

ユーザーが承認していないものを、承認済みとして扱わない。

## 選んだ理由を書く

判断には必ず根拠を添える。

- 一般的な作法と違う選択をしたときは、そう明記する。
  「一般的には X だが、この規模では Y を選んだ」の形で書き、理由を述べる
- 根拠が公式ドキュメントにあるときは出典を示す。
  Next.js は `node_modules/next/dist/docs/` のファイルパス、それ以外は URL
- 根拠が記憶や推測しかないときは、そう書く

「ベストプラクティスだから」で済ませない。

## レビューを受ける

次に該当するものは、提示する前に独立したレビューを受ける。全部をレビューに回すことはしない。

- データベーススキーマの新規作成・変更
- 認証・認可に関わる実装
- トランザクション、並行処理、日付・タイムゾーンの扱い
- 認証なしで外部に公開されるもの
- 「確信が持てていない」と自分で判断した箇所

レビュー結果は無条件に採用しない。妥当性を検討し、採用しなかった指摘は理由とともに残す。

## コミットメッセージ

Conventional Commits に従う。

```
<type>(<scope>): <subject>
```

- type: `feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore`
- scope は任意。省略してよい。使うなら機能名（`habits` / `gacha` / `collection`）
- subject は日本語。命令形ではなく、何をしたかを書く
- 破壊的変更は type のあとに `!` を付ける

形式は `.githooks/commit-msg` が確認する。クローンごとに一度だけ次を実行する。

```
git config core.hooksPath .githooks
```

### コミットの粒度

- 1コミット = 1つの完結した変更。**そのコミットの時点で `npm run build` と `npm test` が通る**
- 本文には「なぜ」を書く。「何を」は diff が語る
- 本文が箇条書き5項目を超えたら、コミットを分けられないか検討する
- `wip` / `typo` のような作業中のコミットを履歴に残さない
- タスクとコミットは別の単位。1つのタスクに独立して意味が通る変更が2つあれば、コミットも2つに分ける
- 赤いテストをコミットしない。テストと実装は同じコミットに入れる

## ドキュメントの書き方

リポジトリに残るドキュメントには、技術的な目的・判断・経緯だけを書く。
作者の経歴や個人的な事情には触れない。
