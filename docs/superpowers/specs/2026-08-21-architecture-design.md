# diet-gacha 設計書

作成日: 2026-08-21
状態: **作成中**（「15. 未確定事項」を参照）

---

## 1. 概要

自分で決めた小さな習慣を達成するとチケットが貯まり、ガチャを引いてカードを集めるアプリ。

継続の動機を「習慣そのもの」ではなく「コレクションを埋めたい」に置き換える。
TypeScript と Next.js を習得するための個人プロジェクトとして開発する。

### 中核となるループ

```
習慣を達成 → チケット獲得（1日3枚まで） → ガチャを引く → カードが図鑑に追加される
```

このループの各段階は、次の性質を満たすよう設計する。

- 習慣は自分で定義できる（何が効くかは本人にしかわからない）
- カードは全ユーザー共通の固定セット（自分で定義できる集合はコレクションにならない）
- 図鑑を埋めるには時間がかかる（申告は水増しできても、経過日数は水増しできない）

---

## 2. 前身となる実装からの変更点

単一 HTML ファイルの実装（localStorage のみ、認証なし）を作成・公開したが、継続的な利用に至らなかった。
今回はゼロから設計し直す。前実装の主な問題は以下。

| 問題 | 今回の対応 |
|---|---|
| 初期状態で景品が空。4件登録するまで1回も引けない | 景品はアプリ側が40枚用意する。登録作業なしで開始できる |
| チケットが1日1枚のみ | 1日3枚まで |
| 報酬が「自分で書いたご褒美」で、達成と無関係に入手できる | 報酬をアプリ内のコレクションに置き、アプリが完全に管理する |
| 抽選がクライアント側。残高が改ざん可能 | 抽選もチケット消費もサーバー側の1トランザクションで行う |
| 日付キーが `toDateString()` でロケール依存 | JST 固定、`DATE` 型で保存 |
| `innerHTML` への文字列連結。手動エスケープで XSS を防いでいた | React により構造的に解決 |
| 状態がグローバル変数。更新のたびに再描画関数を手で呼ぶ | 集計値は保存せず、都度計算する |

---

## 3. スコープ

### 第1弾（今回実装する）

- ユーザー登録・ログイン
- 習慣の登録・編集・削除（実行曜日の指定を含む）
- 日々の達成チェック（誤チェックの取り消しを含む）
- チケット付与（1達成1枚、1日3枚上限）
- ガチャ（全ランダム、サーバー側抽選）
- 図鑑（カード40枚）
- カードごとに「自分へのご褒美」を任意で登録（取得後のみ）
- 継続日数（全体。1日の空白は許容し、2日連続で空いたらリセット）
- 習慣ごとの週次ストリーク
- 達成状況の推移表示
- 図鑑の公開ページと動的 OG 画像

### 第2弾以降（設計では塞がないが、実装しない）

- カード裏面の知識コンテンツと出典
- カード画像
- ジャンルの追加とアンロック
- 保有率・発見順位の表示
- 月次まとめ
- 300枚規模への拡張

### 実装しないと決めたもの

- 体重・食事内容の記録（「体重計にのった」は習慣のひとつとして扱う）
- ユーザーによる景品の追加・編集・選択
- ストリークが途切れた際のペナルティ（コレクションは失わせない）

---

## 4. 技術選定

| 層 | 選定 | 理由 | 検討した代替案と不採用の理由 |
|---|---|---|---|
| フレームワーク | Next.js 16.3.1（App Router） | `node_modules/next/dist/docs/` にバージョン一致のドキュメントが同梱され、実装と参照先がズレない | Next.js 15 系。公式ドキュメントが 16 系前提で書かれているため、参照時に食い違う |
| 言語 / UI | TypeScript / React 19.2.8 / Tailwind CSS v4 | `create-next-app` の既定構成 | — |
| DB | Neon Postgres（Vercel Marketplace） | Vercel から接続でき、Postgres なので既存知識が使える | Vercel Postgres は提供終了済み |
| ORM | Prisma 7.9.1 | 宣言的スキーマとマイグレーション生成の流れが Django ORM と対応する。安定メジャーバージョン | Drizzle ORM。npm の `latest` が 0.45.2 で v1 は RC 段階（rc.4）。開発期間中に破壊的変更が入る可能性がある。生 SQL はマイグレーションの手書きが必要で作業が増える |
| 認証 | Better Auth 1.7.1 | Auth.js の後継として公式に指名されている。Next.js 16 と Prisma 7 を peer 依存に明記。セッションとユーザーを自前 DB に持つ | Auth.js（v5 は 3 年近くベータ。2025-09-22 に Better Auth チームへ移管され、以降はセキュリティ修正のみ）。Clerk・Supabase Auth は認証が外部サービス側に閉じる |
| グラフ | 自作 SVG（ライブラリなし） | 描画がサーバー側で完結し Server Component のまま書ける。クライアントに JavaScript を送らない | Recharts は `'use client'` が必須。Chart.js は依存が2つ増える |
| デプロイ | Vercel | — | — |

### バージョン確認の記録（2026-08-21 時点）

- `next` latest: 16.3.1（Node.js `>=20.9.0`）
- Prisma 7.9.1 の Node.js 要件: `^20.19 || ^22.12 || >=24.0`（Next.js より厳しい）
- `@prisma/client` latest: 7.9.1
- `better-auth` latest: 1.7.1
- `drizzle-orm` latest: 0.45.2 / rc: 1.0.0-rc.4
- `next-auth` latest: 4.24.15 / beta: 5.0.0-beta.32

---

## 5. AI 向け設定

| 対象 | 役割 |
|---|---|
| `AGENTS.md` | Next.js が自動生成。`node_modules/next/dist/docs/` を参照するよう指示する。`next dev` が起動のたびに書き戻すため編集しない |
| `CLAUDE.md` | `@AGENTS.md` の取り込みと、プロジェクト固有の恒常ルール |
| `node_modules/next/dist/docs/` | Next.js 仕様の一次情報。npm でインストールしたバージョンと一致する |
| Vercel React Best Practices Skill | React / Next.js の実装品質。プラグイン提供のものを使い、リポジトリには複製しない |

`.claude/skills/` と `.claude/rules/` は作成しない。必要が生じた時点で追加する。

React Best Practices Skill の内容はパフォーマンス最適化に限られる。
「計測して問題が出てから最適化する」方針と方向が逆になるため、実装中は参照せず、動作するものができてから遅い箇所にのみ適用する。

---

## 6. アーキテクチャ方針

### データアクセスは Data Access Layer に一本化する

Next.js 公式は、データ取得の方式として3つを挙げ、新規プロジェクトには Data Access Layer を推奨している。あわせて「1つ選んで混ぜない」ことを求めている。

DAL が満たすべき要件は次の4点。

1. サーバーでのみ実行する（`import 'server-only'`）
2. 認可チェックを行う
3. 必要最小限の DTO を返す（Prisma の `select` で絞る）
4. セッション取得は React の `cache()` で包み、1リクエスト内で共有する

環境変数（`process.env`）に触れるのは DAL のみとする。

### 認証チェックはレイアウトに置かない

Partial Rendering によりレイアウトは画面遷移時に再レンダリングされず、セッションが毎回検証されない。
またレイアウトは子ルートの実行を止められない。
チェックはデータ取得の入口、すなわち DAL 内で行う。

### Server Action は薄くする

Server Action はエクスポートされた時点で、UI を経由しない直接の POST リクエストからも到達可能になる。
Next.js は推測困難な ID の付与と未使用アクションの削除を行うが、公式は「各アクション内で認証と認可を検証すること」を求めている。

DB 操作と認可を `data/` に集約し、`actions.ts` は DAL の呼び出しと `revalidatePath` のみを行う。
これにより、データに触れる経路が1本に限定される。

### Route Handler は認証エンドポイントのみ

`route.ts` を置くのは Better Auth の `/api/auth/[...all]` だけとする。
Route Handler は外部から叩かれる公開エンドポイントのための機能であり、今回そのような用途はない。

### `proxy.ts` は作らない

未ログイン時のリダイレクトは DAL 側で行える。
`proxy.ts` を置くと「楽観的チェック」と「本来のチェック」で責務が2箇所に分かれ、理解すべき箇所が増える。

### レイヤー分割・DI は導入しない

保護すべきビジネスロジックは3つ（抽選、ストリーク計算、日付・週の境界計算）で、いずれも DB に依存しない純粋関数として `lib/` に切り出す。
これによりテスト容易性は確保される。

Repository インターフェースや DI を導入すると、トランザクションのクライアントを全 Repository に引き回す必要が生じ、「DB に依存しないための仕組み」が DB の都合で歪む。
Next.js 自身が Server / Client の境界とファイル規約による境界を持っているため、層を重ねると境界が二重になる。

以下のいずれかが起きた時点で、あらためて検討する。

- `lib/` の純粋関数が10個を超える
- Web 以外（バッチ、CLI）から同じロジックを呼ぶ必要が出る
- 複数人開発になり、境界を規約で縛る必要が出る
- ORM を移行する現実的な予定ができる

---

## 7. ディレクトリ構成

ページと、そのページでしか使わないものを同じ場所に置く（ルート同居）。
URL とファイルの位置が一致するため、変更時に探す範囲が狭まる。

```
src/
├── app/
│   ├── (auth)/                        ルートグループ。URL には現れない
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (app)/                         ログイン後の画面
│   │   ├── layout.tsx
│   │   ├── page.tsx                   今日のチェック + 推移
│   │   ├── actions.ts
│   │   ├── _components/
│   │   ├── habits/
│   │   │   ├── page.tsx
│   │   │   ├── actions.ts
│   │   │   └── _components/
│   │   ├── gacha/
│   │   └── collection/
│   ├── share/[shareId]/               認証不要の公開ページ
│   │   ├── page.tsx
│   │   └── opengraph-image.tsx
│   └── api/auth/[...all]/route.ts     Better Auth
│
├── data/                              DAL。server-only / 認可 / DTO
│   ├── session.ts
│   ├── habits.ts
│   ├── checkins.ts
│   ├── gacha.ts
│   └── collection.ts
│
├── lib/
│   ├── db.ts                          Prisma クライアント
│   ├── auth.ts                        Better Auth 設定
│   ├── gacha-draw.ts                  抽選の純粋関数
│   └── date.ts                        JST・週境界の純粋関数
│
└── components/                        3箇所以上で使うものだけを置く
```

`_folder` はルーティングから除外される Next.js の規約。
`(group)` は URL に現れないルートグループで、ログイン前後のレイアウト分割に使う。

### 検討した代替案

- **レイヤー別**（`components/` `actions/` `lib/` に種類ごと）: 1機能を変更するのに3ディレクトリを行き来する
- **機能別**（`app/` を薄くし `features/habits/` に実装）: `app/habits/` と `features/habits/` の二重管理になる。7ページの規模では階層が増えるだけ

Next.js 公式はディレクトリ構成について意見を持たず、3つの戦略を提示するに留めている。
上記は実利（探す手間の削減）に基づく選択である。

---

## 8. データモデル

### モデル一覧

| モデル | 役割 | 管理 |
|---|---|---|
| `user` / `session` / `account` / `verification` | 認証 | Better Auth が生成 |
| `Habit` | 習慣の定義 | 自前 |
| `HabitLog` | 達成の記録 | 自前 |
| `Ticket` | チケット台帳 | 自前 |
| `Card` | 景品マスタ（40枚） | 自前 |
| `GachaResult` | ガチャの全履歴（重複含む） | 自前 |
| `UserCard` | 図鑑の所持状況（初回取得のみ） | 自前 |

### スキーマ

Prisma 7.9.1 で `prisma validate` を通した状態のもの。

```prisma
enum Weekday {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN
}

// user / session / account / verification は `npx @better-auth/cli generate` が
// この schema.prisma に生成する。生成されたモデル自体は手で編集しない
// （再生成で失われるため）。下記モデルからのリレーションのみ追記する。

model ShareLink {
  userId    String   @id
  shareId   String   @unique                      // 推測不能なランダム文字列
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Habit {
  id         String    @id @default(cuid())
  userId     String
  name       String
  daysOfWeek Weekday[]
  archivedAt DateTime? @db.Timestamptz(3)         // 論理削除
  createdAt  DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime  @updatedAt @db.Timestamptz(3)

  user       User       @relation(fields: [userId], references: [id], onDelete: Restrict)
  logs       HabitLog[]
  discovered UserCard[]

  @@unique([id, userId])
  @@index([userId])
}

model HabitLog {
  id        String   @id @default(cuid())
  userId    String
  habitId   String
  date      DateTime @db.Date                     // JST 基準
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  habit  Habit   @relation(fields: [habitId, userId], references: [id, userId], onDelete: Restrict)
  ticket Ticket?

  @@unique([habitId, date])
  @@unique([id, userId, date])
  @@index([userId, date])
}

model Ticket {
  id         String    @id @default(cuid())
  userId     String
  habitLogId String    @unique
  earnedDate DateTime  @db.Date
  dailySeq   Int                                  // 1〜3。その日の3枠のどれを占有しているか
  earnedAt   DateTime  @default(now()) @db.Timestamptz(3)
  consumedAt DateTime? @db.Timestamptz(3)

  habitLog HabitLog     @relation(fields: [habitLogId, userId, earnedDate], references: [id, userId, date], onDelete: Restrict)
  result   GachaResult?

  @@unique([habitLogId, userId, earnedDate])
  @@unique([userId, earnedDate, dailySeq])
  @@unique([id, userId])
  @@index([userId, consumedAt])
}

model Card {
  id              Int     @id                     // 図鑑番号。シードで明示指定する
  name            String
  flavorText      String
  rarity          Int
  emoji           String
  imagePath       String?                         // 第2弾
  knowledge       String?                         // 第2弾（裏面）
  sourceUrl       String?                         // 第2弾（出典）
  discoveredCount Int     @default(0)             // 発見順位の採番用

  results GachaResult[]
  owners  UserCard[]
}

model GachaResult {
  id           String   @id @default(cuid())
  userId       String
  cardId       Int
  ticketId     String   @unique
  drawnAt      DateTime @default(now()) @db.Timestamptz(3)
  streakAtDraw Int

  card    Card      @relation(fields: [cardId], references: [id], onDelete: Restrict)
  ticket  Ticket    @relation(fields: [ticketId, userId], references: [id, userId], onDelete: Restrict)
  firstOf UserCard?

  @@unique([ticketId, userId])
  @@unique([id, userId, cardId])
  @@index([userId, drawnAt])
}

model UserCard {
  id             String   @id @default(cuid())
  userId         String
  cardId         Int
  firstResultId  String   @unique
  viaHabitId     String
  discoveryRank  Int
  personalReward String?
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  card        Card        @relation(fields: [cardId], references: [id], onDelete: Restrict)
  firstResult GachaResult @relation(fields: [firstResultId, userId, cardId], references: [id, userId, cardId], onDelete: Restrict)
  viaHabit    Habit       @relation(fields: [viaHabitId, userId], references: [id, userId], onDelete: Restrict)

  @@unique([firstResultId, userId, cardId])
  @@unique([userId, cardId])
  @@unique([cardId, discoveryRank])
}
```

### CHECK 制約

Prisma のスキーマでは表現できないため、raw SQL のマイグレーションで追加する。

```sql
ALTER TABLE "Ticket" ADD CONSTRAINT ticket_daily_seq CHECK ("dailySeq" BETWEEN 1 AND 3);
ALTER TABLE "Card"   ADD CONSTRAINT card_rarity      CHECK ("rarity" BETWEEN 1 AND 4);
ALTER TABLE "Habit"  ADD CONSTRAINT habit_days_count CHECK (cardinality("daysOfWeek") BETWEEN 1 AND 7);
```

`daysOfWeek` の重複（`[MON, MON]`）はアプリ側で検証する。検証関数は1つだけ定義し、作成と更新の両方から呼ぶ。

### 設計の意図

**保存するのは事実、計算するのは集計。**

| 項目 | 扱い | 理由 |
|---|---|---|
| 週の目標回数 | 保存しない | `daysOfWeek` の要素数から求まる |
| チケット残高 | 保存しない | `consumedAt IS NULL` の件数 |
| 継続日数（全体） | 保存しない | `HabitLog` の日付から計算 |
| 習慣ごとのストリーク | 保存しない | `HabitLog` を週単位で集計 |
| 発見順位 | **保存する** | 挿入時点でしか確定できない |
| `dailySeq` | **保存する** | 1日3枚の上限を一意制約で表現するため |

**「1達成1チケット」と「1日3枚」を DB 制約で保証する。**
`Ticket.habitLogId` を一意にすることで、同一の達成記録から2枚目が発行されることを不可能にする。
`@@unique([userId, earnedDate, dailySeq])` と `CHECK (dailySeq BETWEEN 1 AND 3)` の組み合わせが、1日3枚の上限そのものを表現する。アプリ側の件数チェックに依存しないため、並行リクエストでも破れない。

集計テーブル（日次の発行枚数カウンタ）を持つ案も検討したが、チケットの実枚数と二重の真実になるため採用しなかった。

**複合外部キーでユーザーの一貫性を DB に保証させる。**
`HabitLog.userId` が親の `Habit.userId` と一致することを、複合外部キーで強制する。
これがないと、サーバーアクションで所有者チェックを1箇所書き忘れた時点で、他人の習慣を自分の記録として保存できてしまう。しかも自分の一覧に表示されるため気づかない。

同じ関係を `Ticket → HabitLog`、`GachaResult → Ticket`、`UserCard → GachaResult`、`UserCard → Habit` にも適用している。

Prisma は 1:1 リレーションの定義側について、`fields:` に並べたフィールドの組み合わせそのものに一意制約を要求する。そのため `@@unique([habitLogId, userId, earnedDate])` などが必要になる。単体の `@unique` と重複するが回避できない。

**`userId` の外部キーは `Habit` と `ShareLink` にのみ張る。**
複合外部キーの連鎖が参照整合性を推移的に保証しているため、子テーブルに追加の外部キーは不要。

```
HabitLog.userId    → Habit(id, userId)            → user.id
Ticket.userId      → HabitLog(id, userId, date)   → 上に帰着
GachaResult.userId → Ticket(id, userId)           → 上に帰着
UserCard.userId    → GachaResult(id,userId,cardId) → 上に帰着
```

**参照アクションはすべて明示する。**
Prisma の既定値は optional が `SetNull`、必須が `Restrict`。
`viaHabitId` を optional のままにすると、習慣を物理削除したときに「どの習慣で得たか」の記録が黙って NULL になる。
そのため `viaHabitId` は必須とし、全リレーションに `onDelete` を明示する。

**退会処理は DB のカスケードに任せない。**
内部のリレーションが `Restrict` であるため、`user` からのカスケード削除は途中で失敗する。
1トランザクションで、子から親の順に明示的に削除する。

```
UserCard → GachaResult → Ticket → HabitLog → Habit → ShareLink → user
```

**習慣は論理削除する。**
物理削除すると `UserCard.viaHabitId` の参照先が失われるため。

**後から復元できない情報のみ、第1弾から記録する。**
発見順位、取得時のストリーク、きっかけとなった習慣、取得日時がこれに該当する。表示は第2弾でよい。

### チケット発行の手順

その日の3枠のうち、未使用の最小値を選んで挿入する。

```sql
INSERT INTO "Ticket" ("id","userId","habitLogId","earnedDate","dailySeq")
SELECT $1, $2, $3, $4, s
FROM generate_series(1, 3) AS s
WHERE NOT EXISTS (
  SELECT 1 FROM "Ticket" t
  WHERE t."userId" = $2 AND t."earnedDate" = $4 AND t."dailySeq" = s
)
ORDER BY s
LIMIT 1;
```

- 影響行数 0 = その日は上限に達している（チケットを発行しない。正常系）
- 影響行数 1 = 発行成功

「その日の件数を数えて +1」という方式は採用しない。
誤チェックの取り消しで `dailySeq` に穴が空くと（例: 1 と 3 が残る）、件数が 2 なので常に 3 を選び、既存の 3 と衝突し続けて無限リトライになるため。

一意制約違反によるリトライは、**トランザクションの外側**に置く。
PostgreSQL では一意制約違反の時点でトランザクション全体がアボート状態になり、内側での回復ができないため。
またリトライ対象は `dailySeq` の衝突に限る。`@@unique([habitId, date])`（同じ習慣を同日に2回チェック）はリトライしても成功しないユーザーエラーであり、区別する必要がある。

### 誤チェックの取り消し

未消費のチケットが紐づく `HabitLog` のみ削除できる。1トランザクションで `Ticket` → `HabitLog` の順に削除する。

消費済みチケットは `GachaResult → Ticket` の `Restrict` によって削除が阻止されるため、「未消費のみ取り消し可」という仕様は DB 側でも強制される。
ただしアプリ側でも事前に判定し、外部キー違反ではなく意味のあるエラーを返す。

### 発見順位の採番

同一トランザクション内で `Card.discoveredCount` を原子的にインクリメントし、戻り値をそのまま `discoveryRank` に使う。
Prisma の atomic number operation がそのまま `UPDATE ... SET x = x + 1 ... RETURNING` になる。

`@@unique([cardId, discoveryRank])` が安全網として機能し、採番に不具合があれば静かに壊れる代わりにエラーになる。

### 第2弾でのスキーマ変更

追加が必要なのは `Genre` テーブル、`Card.genreId`、ジャンル解放状況を持つ `UserGenre` テーブルのみ。
既存データは1ジャンルに寄せるだけで、作り直しは発生しない。

保有率の分母（全ユーザー数）は、Better Auth のモデルが同じスキーマにあるため通常のクエリで取得できる。

## 9. 画面とデータの流れ

### 画面ごとの読み書き

| ルート | 読む（DAL） | 書く（Server Action → DAL） |
|---|---|---|
| `/` | `getTodayView()` | `checkIn(habitId)` / `undoCheckIn(habitId)` |
| `/habits` | `listHabits()` | `createHabit` / `updateHabit` / `archiveHabit` |
| `/gacha` | `getGachaView()` | `drawGacha()` |
| `/collection` | `getCollection()` | `setPersonalReward(cardId, text)` |
| `/share/[shareId]` | `getPublicCollection(shareId)` | なし |

`page.tsx` は DAL の関数を1つ呼ぶだけにする。画面ごとに必要なデータを1つの関数にまとめることで、`page.tsx` の中で複数のクエリを書かずに済む。

### DAL の構成

```
src/data/
├── session.ts
│   ├── getSession()        cache() で包む。未ログインなら null
│   └── requireUser()       未ログインなら redirect('/login')
│
├── habits.ts
│   ├── listHabits()
│   ├── getTodayView()      今日の一覧 + 継続日数 + チケット残高 + 推移データ
│   ├── createHabit(input)
│   ├── updateHabit(id, input)
│   └── archiveHabit(id)
│
├── checkins.ts
│   ├── checkIn(habitId)
│   └── undoCheckIn(habitId)
│
├── gacha.ts
│   ├── getGachaView()
│   └── drawGacha()
│
└── collection.ts
    ├── getCollection()
    ├── setPersonalReward(cardId, text)
    └── getPublicCollection(shareId)   認証不要
```

全ファイルの先頭に `import 'server-only'` を付ける。

`getPublicCollection` は認証を要求しない唯一の DAL 関数。`shareId` から所有者を引き、公開してよい項目だけを返す。
`personalReward`、メールアドレス、習慣の名前は返さない。
公開ページに個人的な情報が漏れる経路を、この関数1つに閉じ込める。

### ガチャのトランザクション手順

`data/gacha.ts` の `drawGacha()`。以下を1トランザクションで行う。

```
1. requireUser()

2. 未消費チケットを1枚ロックして消費
   UPDATE "Ticket" SET "consumedAt" = now()
   WHERE id = (SELECT id FROM "Ticket"
               WHERE "userId" = $1 AND "consumedAt" IS NULL
               ORDER BY "earnedAt" LIMIT 1
               FOR UPDATE SKIP LOCKED)
   RETURNING id, "habitLogId"
   → 0行なら「チケットがありません」を戻り値で返す

3. 継続日数を計算（この時点の HabitLog から）

4. 抽選（lib/gacha-draw.ts の純粋関数）

5. GachaResult を作成（ticketId / cardId / streakAtDraw）

6. UserCard が無ければ（初取得）
   a. Card.discoveredCount を原子的に +1 → 戻り値が discoveryRank
   b. UserCard を作成（viaHabitId は ticket → habitLog → habitId から取る）

7. コミット
```

`GachaResult.ticketId` の一意制約だけでも二重消費は防げるが、それだけだと同時に2回引いたとき片方が一意制約違反で落ちる。
チケットが2枚あれば本来どちらも成功すべきなので、`FOR UPDATE SKIP LOCKED` で別々の行を掴ませる。

### 抽選のアルゴリズム

2段階で引く。

```ts
pickRarity(weights: number[], rand: number): number
pickCard(cards: Card[], rarity: number, rand: number): Card
```

1回の重み付き抽選でカードを直接選ぶと、**レアリティごとの排出率がカードの枚数に引きずられる**。
★4のカードを1枚追加しただけで★4の排出率が上がってしまうため、排出率とラインナップを独立して調整できるよう2段階にする。

**乱数は引数で受け取る。** 関数の内部で `Math.random()` を呼ばないことで、テストから境界値を直接渡せる。

| 項目 | 決定 | 変更が必要になる条件 |
|---|---|---|
| レアリティの重み | コード定数（50/30/15/5）。`pickRarity` は引数で受け取る形にする | 管理画面から変更したくなったら `Rarity` テーブルへ |
| 同一レアリティ内の分布 | 等確率。カードごとの重みは持たない | 目玉カードを作るなら `Card.weight` を追加。天井の設計もセットで必要 |
| ガチャの種類（複数プール） | 持たない | 第2弾のジャンル別プールで再検討 |

重みをコード定数にする理由は、排出率がゲームバランスそのものであり、**変更が git の履歴に残るべき**だから。
DB に置くと「いつ確率を変えたか」を後から追えない。

同一レアリティ内を等確率にする理由は、特定のカードの重みを下げるとクーポンコレクター問題の裾が伸び、
コンプ時間の見積もり（セクション12）が崩れるため。図鑑のコンプを動機の中心に据えているため、
到達困難なカードを作ると設計意図と衝突する。

第2弾でジャンル別のアンロックを入れると、ユーザーが引けるプールに特定のレアリティが存在しない状態が起こりうる。
そのときは重みの再配分が必要になる。第1弾は固定40枚で全レアリティが常に存在するため、この問題は起きない。

### 継続日数の計算

`lib/date.ts` の純粋関数として実装する。

```ts
calcStreak(dates: string[], today: string): number
calcWeeklyStreak(dates: string[], target: number, today: string): number
```

**`today` を引数で受け取る。** 「2日連続で空いたらリセット」という規則は、記録同士の間隔だけでなく
最後の記録日と今日の距離にも適用されるため、日付の配列だけでは値が決まらない。

**全体の継続日数**

- 最後の記録日が `today - 2` 以内ならストリークは生きている
- 記録日どうしの間隔が2日以内なら同じ連続とみなす
- 数えるのは記録した日数（暦の日数ではない）。月・火・木（水は空白）は **3日**

**呼称は「継続日数」とする。** 空白を許容する規則なので「連続日数」と呼ぶと表示が実態と食い違う。
画面には数字の下に「1日空いても途切れません」と1行添える。

規則を厳格な連続にしない理由はセクション13を参照。

**習慣ごとの週次ストリーク**

- 日付を ISO 週（月曜始まり）でグループ化する
- 今週は進行中なので特別扱いする。目標達成なら数え、未達成でも途切れさせない
- 先週以前は、目標未達の週が出た時点で終了

今週を特別扱いしないと、月曜の朝にすべてのストリークが 0 になる。

### 推移表示

`/` の下部に、直近12週の「週あたり達成日数」を折れ線で表示する。

- 縦軸 0〜7、横軸は週
- 自作 SVG。`<polyline>` 1本と目盛りのみ
- Server Component。クライアントに JavaScript を送らない

日単位ではなく週単位にする理由は、習慣の評価軸が週であり画面内で単位が揃うこと、
点が12個に収まって SVG が単純になること。

---

## 10. エラー処理

### 想定内の失敗は戻り値、想定外は例外

Next.js 公式ドキュメント（`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`）が同じ分類を示している。

> Errors can be divided into two categories: expected errors and uncaught exceptions.

> For these errors, avoid using `try`/`catch` blocks and throw errors. Instead, model expected errors as return values.

| 種類 | 例 | 扱い |
|---|---|---|
| 入力の不備 | 習慣名が空、曜日が0個 | Server Action が戻り値で返す |
| 業務ルールによる拒否 | チケット不足、1日3枚到達、消費済みチケットの取り消し | 同上 |
| 未ログイン | セッションが無い | DAL が `redirect('/login')` |
| 他人のリソース（ページ） | 他人の `shareId` 以外のリソース | `notFound()` |
| 他人のリソース（Server Action） | 他人の `habitId` を指定 | 更新0行 → 汎用の失敗を返す。理由は返さない |
| 想定外 | DB 接続断、バグ | 例外 → `error.tsx` |

「チケットが足りない」は例外ではなく正常な状態のひとつ。
例外にすると、ログ上で本当のバグと区別がつかなくなる。

### 他人のリソースを 403 ではなく 404 にする理由

ID の列挙によって、リソースの存在や他ユーザーの情報が推測できてしまうため、存在しないものとして扱う。

この設計では自然に実現される。DAL のクエリは常に `userId` で絞るため、他人のリソースは単に0件が返る。
所有者かどうかを別途判定する必要がなく、例外を投げるより問い合わせが少なくて済む。

Server Action には 404 を返す先が無いため、詳細を伏せた汎用エラーを返す。

### Server Action の戻り値

```ts
type ActionResult =
  | { ok: true }
  | { ok: false; message: string }
```

判別可能なユニオン型（discriminated union）。`ok` の値によってオブジェクトの形が変わり、
分岐したあとは TypeScript が型を絞り込む。例外を使わずに失敗を表現する定番の形。

ジェネリックな `ActionResult<T>` にはしない。「独自の型ユーティリティやジェネリクスの多用」を避ける方針のため。
戻り値にデータが必要になった時点で拡張する。

### バリデーションはライブラリを使わない

Next.js 公式の例では Zod が使われている。一般的には Zod を導入する場面である。

今回検証する内容は次の4件のみで、関数1つ20行程度で書ける。

- 習慣名が空でない / 30文字以内
- 曜日が1〜7個 / 重複なし

**撤退条件**: 検証ルールが10件を超えるか、入れ子のオブジェクトを検証する必要が出た時点で Zod を導入する。

### ファイル配置

| ファイル | 役割 |
|---|---|
| `src/app/(app)/error.tsx` | ログイン後の画面で起きた想定外のエラー |
| `src/app/global-error.tsx` | ルートレイアウト自体が壊れた場合 |
| `src/app/share/[shareId]/not-found.tsx` | 存在しない公開ページ |

`error.tsx` の引数は Next.js 16 では `{ error, retry }`。15 系までの `reset` から変わっている。

`redirect()` と `notFound()` は内部的に特別な例外を投げて動作する。
自前の `try/catch` で握り潰さないよう注意する。

ログは `console.error` で足りる（Vercel の Function ログに出る）。監視ライブラリは導入しない。

---

## 11. テスト

### 方針：カバレッジ目標は設定せず、リスクの高い箇所に本数を割く

カバレッジを品質目標にしない。Inozemtseva & Holmes（ICSE 2014、5システム・最大72.4万行・31,000のテストスイートをミューテーションテストで評価）は次のように結論している。

> coverage should not be used as a quality target because it is not a good indicator of test suite effectiveness

同研究では、バグ検出力を予測するのはカバレッジではなく**テストの本数**であるとされている。
したがって「何%」ではなく「どのリスクに何本割くか」で決める。

また Next.js 公式ドキュメント（`node_modules/next/dist/docs/01-app/02-guides/testing/index.md`）は次のように述べている。

> Since `async` Server Components are new to the React ecosystem, some tools do not fully support them.
> In the meantime, we recommend using End-to-End Testing over Unit Testing for `async` components.

`page.tsx` のユニットテストは書かない。

### 3層に分けて配分する

| 層 | 対象 | 本数 | 理由 |
|---|---|---|---|
| 1 | `lib/date.ts` / `lib/gacha-draw.ts`（純粋関数） | 15〜20 | 境界条件が多い。DB が不要で速い |
| 2 | 認証・ルーティング・バリデーションの E2E | 3〜5 | 状態に依存しない経路のみ |
| 3 | `data/` のトランザクション（実 DB） | 4〜6 | **設計レビューで見つかった Critical はすべてこの層** |
| — | コンポーネントテスト | 0 | UI を薄く保つ方針のため、得られる確信が小さい |

Google Testing Blog「Just Say No to More End-to-End Tests」は 70/20/10 を推奨し、E2E の問題として不安定さ、フィードバックの遅さ、原因特定の難しさ、CI 時間の膨張を挙げている。
このうち**不安定さと実行時間は、テストを自動生成しても減らない**。したがって E2E は増やさない。

一方、層3を避けていた理由は準備コストのみだった。コンテナで DB を用意すれば解消するため、第1弾に含める。

### 層3で書くもの（実 DB が必要なもの）

純粋関数でも E2E でも検出できない、並行実行と整合性の検証に限定する。

```
1. 同じ習慣を並行して2回チェック → チケットが1枚しか発行されない
2. 1日に4件達成 → チケットは3枚で止まる
3. チケット1枚で並行して2回ガチャ → 1回しか引けない
4. チェック → 取り消し → 再チェック → dailySeq が衝突しない
5. 同じカードを2人が同時に初取得 → discoveryRank が重複しない
```

**テスト用 DB は Docker で用意する。** リポジトリの `compose.yaml` を参照。

- イメージは `postgres:18`。Neon の新規プロジェクトの既定が Postgres 18 のため、メジャーバージョンを揃える
- ポートは 5433。ホストで動いている PostgreSQL 14 と衝突させないため
- Postgres 18 から `PGDATA` が `/var/lib/postgresql/<major>/docker` に変わっている。マウント先はその1つ上の `/var/lib/postgresql` にする必要がある（17 までの `/var/lib/postgresql/data` にマウントすると起動に失敗する）

```bash
docker compose up -d     # 起動
docker compose down -v   # データごと破棄
```

### 層1で書くテストケース

```
calcStreak
  - 記録なし → 0
  - 今日のみ → 1
  - 昨日まで（今日未記録）→ 継続している
  - 1日空き（月・水）→ 継続、2日
  - 2日空き（月・木）→ 途切れる
  - 最終記録が today-2 → 生きている
  - 最終記録が today-3 → 0

calcWeeklyStreak
  - 今週が進行中で未達 → 前週までの連続数を返す（0にしない）
  - 目標未達の週で打ち切る
  - 週境界（月曜0時 JST）

jstToday
  - UTC 14:59 → 当日
  - UTC 15:00（= JST 翌0時）→ 翌日

pickRarity
  - rand = 0 → ★1
  - rand = 0.4999 / 0.5 → ★1と★2の境界
  - rand = 0.9999 → ★4
```

### ツールは Vitest

`node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md` に公式のセットアップ手順がある。

**検討して採用しなかった案**: Node 24 の組み込みテストランナー（`node --test` + `node:test`）。
依存ゼロで、Node 24 は TypeScript をそのまま実行できる。
採用しなかったのは、`@/` のパス別名（tsconfig の `paths`）の解決に追加設定が必要なため。

**注意**: `import 'server-only'` を含むファイルはテストから読み込めない（そのためのパッケージであるため）。
層3では `data/` を直接呼ばず、Prisma クライアント経由で同じ SQL を実行する形にするか、
テスト時に `server-only` を解決できるよう設定する必要がある。実装時に確認する。

### E2E は playwright-cli の操作から生成する

`playwright-cli` は、実行した操作に対応する Playwright の TypeScript を出力する。
`references/test-generation.md` に plan → generate → heal のワークフローがある。

対話的な動作確認と E2E テストの生成を、同じ操作から行う。

ただし生成されるのは操作であって表明（assertion）ではないため、期待値は別途書く。

### 手動で確認する項目

自動化しないものは、`playwright-cli` で操作して確認する。

- ログアウト状態で `/habits` を直接開く → ログイン画面へ遷移するか
- チケット0でガチャを引く → 意味のあるエラーが出るか
- 4件目の達成 → チケットが増えないこと
- 二重送信（ボタン連打、通信遅延、ブラウザの戻る）→ 二重発行されないこと
- 日付境界（23:59 と 00:01 のチェック）→ 正しい日付で記録されること
- 存在しない `shareId` → 404 になること
- 他人の `shareId` → 閲覧できるが、個人的な情報が出ないこと

---

## 12. ゲームバランス

### 排出率とカード構成

- 全40種
- ★1: 50% / ★2: 30% / ★3: 15% / ★4: 5%
- 排出率は画面に表示する
- チケットは1日3枚まで、ガチャ1回につき1枚消費

### 到達時間の見積もり

モンテカルロシミュレーション（20,000試行、1日3枚を消費した場合）。

| 構成 | 初★4まで | 図鑑50% | コンプ（中央値） | コンプ（p90） |
|---|---|---|---|---|
| 24種 / 排出率 70-20-8-2 | 35回（12日） | 18回（6日） | 166回（56日） | 305回（102日） |
| **40種 / 排出率 50-30-15-5** | **14回（5日）** | 27回（9日） | 198回（66日） | 315回（105日） |
| 40種 / 排出率 70-20-8-2 | — | — | 413回（138日） | 738回（246日） |

40種・排出率 50-30-15-5 を採用する。決め手は「初★4までが5日」で、継続率の分岐点とされる7日目より前に最も強い報酬体験が来ること。

### 第2弾（300枚規模）の見積もり

| 構成 | 50%到達 | 80%到達 | 100%到達（中央値） |
|---|---|---|---|
| 1ジャンル100枚 | 70回（24日） | 168回（56日） | 627回（209日） |
| 全300枚を通しで | 212回（71日） | — | 2,432回（**811日**） |

ジャンルに区切らないと2年以上かかるため、ジャンル制は必須。
一方、1ジャンルの100%到達は中央値で7ヶ月かかるため、節目トリガーとしては機能しない（25/50/75% は有効）。

---

## 13. 設計判断の根拠

### ランダム報酬を採用する理由

変動比率スケジュールは反応率が高く消去されにくい。
ルートボックス研究でも、レアな報酬ほど覚醒・報酬反応が大きいことが報告されている。

- Ferster, C. B. & Skinner, B. F. (1957). *Schedules of Reinforcement*
- [Rare Loot Box Rewards Trigger Larger Arousal and Reward Responses (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7882574/)

### 報酬をアプリ内に閉じる理由

Milkman らの誘惑バンドリング実験では、オーディオブックを「ジムでしか聴けない」状態にした群でジム利用が51%増加した。
自分で我慢するよう推奨されただけの群は29%に留まった。
2020年の追跡研究では、介入終了から17週後も週あたりの運動実施率が10〜14%高かった。

報酬の質ではなく、**その行動でしか入手できないという排他性**が効いている。
前実装の景品は現実世界のご褒美であり、達成の有無にかかわらず入手できたため排他性がなかった。
コレクションはアプリが完全にゲートできる唯一の報酬である。

- [Holding the Hunger Games Hostage at the Gym (PubMed)](https://pubmed.ncbi.nlm.nih.gov/25843979/)
- [Teaching temptation bundling to boost exercise (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S074959782030385X)

### 自己申告でも成立する理由

Duolingo の Streak Wager は、アプリ内通貨を自己申告の目標に賭ける仕組みで、現実の損失は発生しない。
それでも Day-7 継続率が14%改善している。

自己モニタリングも、複数のメタ分析で食事・運動の行動変容に有効と確認されている。
ただし単体ではなく、**目標設定とフィードバックを併用した場合**に効果が出る。
本アプリでは、目標設定＝習慣の定義、フィードバック＝推移表示と週次進捗の表示が対応する。

偽造できないのは経過時間である。1日3枚の上限があることで、図鑑の充足度が経過日数の証明として機能する。

- [How Streaks keep Duolingo learners committed（Duolingo 公式）](https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/)
- [Effective techniques in healthy eating and physical activity interventions: a meta-regression (Michie et al.)](https://www.ncbi.nlm.nih.gov/books/NBK77075/)

### 実行曜日を指定させる理由

「いつ・どこで・どうやるか」を事前に決める実行意図は、94研究・8,000人以上のメタ分析で目標達成に d = 0.65 の効果が確認されている。
状況と行動が結びつくことで、意志力を使わずに行動が起動する。

ただし効果が確認されているのは「事前に計画すること」であり、「計画外の実行を無効とすること」ではない。
そのため曜日は計画として扱い、評価は週の達成回数で行う。

- [Implementation Intentions and Goal Achievement: A Meta-Analysis (Gollwitzer & Sheeran, 2006)](https://www.sciencedirect.com/science/chapter/bookseries/abs/pii/S0065260106380021)

### 休める仕組みを入れる理由

Duolingo の Weekend Amulet（休んでもストリークが途切れない仕組み）は、翌週の復帰率を4%改善し、ストリーク喪失を5%減らした。
また、集中的に利用する層のほうが離脱しやすいことも報告されている。

前実装は1日空けた時点でストリークが0に戻る仕様だった。
今回は猶予1日とし、2日続けて空いた場合にのみリセットする。
実装量は猶予なしの場合と変わらない（日付比較の閾値が変わるのみ）。

### 過正当化効果への対応

物質的報酬が内発的動機を損なうことは、128研究のメタ分析で示されている。

本アプリでは影響は限定的と判断する。対象となる小さな習慣にはもともと内発的動機が乏しく、損なわれる対象が少ないため。
ゲーミフィケーションされたフィットネスアプリの研究では、報酬が内発的動機を押し上げる（crowding in）事例も報告されている。

ストリークが途切れてもコレクションは失わせない。喪失体験はアプリ自体からの離脱を招くため。

- [Deci, Koestner & Ryan (1999) メタ分析](https://home.ubalt.edu/tmitch/642/articles%20syllabus/Deci%20Koestner%20Ryan%20meta%20IM%20psy%20bull%2099.pdf)
- [Motivation crowding effects on gamified fitness apps (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10807424/)

### 保有率・発見順位を第2弾に回す理由

利用者が少ない段階では「保有者1人目」「保有率100%」としか表示できず、共有カードに載せると逆効果になる。
記録自体は第1弾から行い、表示は一定の利用者数を超えてから有効化する。

### コンテンツの品質保証（第2弾）

カード裏面に知識を載せる場合、事実の生成を AI に任せない。
一次情報を人が選定し、AI は文章化のみを担当する。
「意外な知見」を狙うほど、正しい発見と誤りの区別が難しくなるため。

数値は記載しない（誤りが致命的になり、かつ数値がなくても意外性は成立する）。
希少度の高いカードほど出典リンクを必須とする。

---

## 14. 実装の前提条件

### Node.js を 20.19 以上に更新する

**必須。** Prisma 7 は Node.js 20.19+ / 22.12+ / 24.0+ でないと、インストール時の preinstall スクリプトで停止する（警告ではなくエラー）。

```
Prisma only supports Node.js versions 20.19+, 22.12+, 24.0+.
```

Next.js 16 の要件は 20.9 以上なので、Next.js だけなら古い Node でも動いてしまう。Prisma を入れる段階で必ず詰まる。
Vercel の既定ランタイムは Node 24 なので、ローカルもそれに合わせるのが望ましい。

### Prisma 7 では接続 URL をスキーマに書けない

Prisma 7 の破壊的変更。`datasource` ブロックに `url` を書くと以下のエラーになる。

```
The datasource property `url` is no longer supported in schema files.
```

接続 URL は `prisma.config.ts` に置き、`PrismaClient` には driver adapter（Neon なら `@prisma/adapter-neon`）を渡す。

### 実装前に公式ドキュメントで確認すること

推測で実装しない箇所。

- Better Auth の Prisma アダプタの設定と、`npx @better-auth/cli generate` の実行手順
- Prisma 7 の `prisma.config.ts` と driver adapter の書き方
- Prisma 7 のトランザクション API
- Neon のプール接続（PgBouncer）と Prisma のインタラクティブトランザクションの組み合わせ
- `opengraph-image.tsx` の記法と制約

---

## 15. 未確定事項

以下は未決定。決まり次第この文書に追記する。

- **カードのテーマと40種の中身。**「習慣の科学」は一例であり決定していない。
  「1枚絵 + 名前 + フレーバーテキスト + レア度」で表せるものであれば、データ構造は変わらない。
  順序のあるもの（物語、絵本）や動画は構造が変わるため、採用する場合は設計から見直す
- 目玉カード（特定の1枚を出にくくする）を作るかどうか。
  作る場合は `Card.weight` の追加と天井の設計、コンプ時間の再計算が必要

### 実装時に検証してから決めること

推測で実装せず、小さな検証コードで挙動を確かめる。

- **Server Action で投げた例外が `error.tsx` に到達するか。**
  同梱ドキュメントを検索したが、この点に関する記述は見つからなかった。
  到達しない場合は Server Action 側で処理する必要がある
- `useActionState` の React 19 における正確なシグネチャ
- Vitest が Next.js 16 / React 19 環境で動作するか。`@/` のパス別名の解決

---

## 16. 設計レビューの記録

データモデルとエラー処理は、実装前に独立したレビューを実施した。

**1回目** — Critical 6件（公開URL用の識別子の欠落、1日3枚上限が並行実行で破れる、発見順位の採番競合、`userId` の一貫性が未検証、`firstResult` が別カードを指せる、`onDelete` 未指定）。すべて反映済み。

このうち2件は一次情報で裏を取った。

- Prisma の `onDelete` 既定値が optional で `SetNull` であること（公式ドキュメントで確認）
- Better Auth の Prisma アダプタが `schema.prisma` にモデルを生成し、リレーションを追記できること（公式ドキュメントで確認）。これにより「認証テーブルには触れない」という当初の前提を撤回した

**2回目** — Blocking 3件。すべて反映済み。

- Prisma が 1:1 リレーションの複合外部キーに、フィールドの組み合わせそのものへの一意制約を要求する（`prisma validate` で実測）
- 「件数 +1」による `dailySeq` の採番が、誤チェックの取り消しと組み合わさると無限リトライになる
- `user` からのカスケード削除が内部の `Restrict` と衝突し、退会処理が失敗する

**3回目（エラー処理・テスト）** — 反映したもの。

- 他人のリソースは例外ではなく `notFound()` にする。ID の列挙を防ぐため
- Zod を導入しない判断に、撤退条件を明記する
- 継続日数の呼称。空白を許容する規則を「連続日数」と呼ぶと表示が実態と食い違う
- 手動確認に、二重送信と日付境界（23:59 / 00:01）を追加する

**レビュー指摘のうち採用しなかったもの**

- 継続日数を raw SQL の window 関数で計算する案。年間365行程度の規模では性能上の利点がなく、純粋関数のほうがテストしやすく読みやすいため
- 日次の発行枚数を持つ集計テーブルを追加する案。チケットの実枚数と二重の真実になり、「集計で求まる値をカラムに持たない」方針と衝突するため
- `ActionResult` をジェネリックにして拡張余地を持たせる案。「独自の型ユーティリティやジェネリクスの多用」を避ける方針に反する。必要になった時点で拡張する
- トランザクション内の状態遷移を純粋関数に抽出してテストする案。抽出対象の分岐は原子性のために意図的に SQL 側へ置いており、取り出すと競合の問題が戻るため

**指摘のうち事実と異なっていたもの**

- 「継続日数の規則を後から変えると DB 設計や表示ロジックまで波及する」という指摘。
  継続日数は保存しておらず `HabitLog` から都度計算するため、影響するのは純粋関数1つ。
  唯一の結合は `GachaResult.streakAtDraw` のスナップショットだが、これは履歴として旧規則の値が残るのが正しい挙動
