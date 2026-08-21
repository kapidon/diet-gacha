# diet-gacha 設計書

作成日: 2026-08-21
状態: **作成中**（「11. 未確定事項」を参照）

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
- 日々の達成チェック
- チケット付与（1達成1枚、1日3枚上限）
- ガチャ（全ランダム、サーバー側抽選）
- 図鑑（カード40枚）
- カードごとに「自分へのご褒美」を任意で登録（取得後のみ）
- 全体ストリーク（猶予1日）
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
│   ├── tickets.ts
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

```prisma
// Better Auth が user / session / account / verification を生成する。
// user への項目追加は Better Auth の拡張機構を使う。
//   追加するもの: shareId（公開ページ用の識別子）

model Habit {
  id         String   @id @default(cuid())
  userId     String
  name       String
  daysOfWeek Int[]              // 0=月 ... 6=日。実行する曜日
  archivedAt DateTime?          // 論理削除
  createdAt  DateTime @default(now())

  logs       HabitLog[]
  discovered UserCard[]

  @@index([userId])
}

model HabitLog {
  id      String   @id @default(cuid())
  userId  String
  habitId String
  date    DateTime @db.Date      // JST 基準の日付
  habit   Habit    @relation(fields: [habitId], references: [id])
  ticket  Ticket?

  @@unique([habitId, date])
  @@index([userId, date])
}

model Ticket {
  id         String    @id @default(cuid())
  userId     String
  habitLogId String    @unique   // 1達成につき最大1枚
  earnedAt   DateTime  @default(now())
  earnedDate DateTime  @db.Date  // 1日3枚判定用
  consumedAt DateTime?

  habitLog HabitLog     @relation(fields: [habitLogId], references: [id])
  result   GachaResult?

  @@index([userId, consumedAt])
  @@index([userId, earnedDate])
}

model Card {
  id              String  @id
  number          Int     @unique      // 図鑑番号 1〜40
  name            String
  flavorText      String
  rarity          Int                  // 1〜4
  emoji           String
  imagePath       String?              // 第2弾
  knowledge       String?              // 第2弾（裏面）
  sourceUrl       String?              // 第2弾（出典）
  discoveredCount Int     @default(0)  // 発見順位の採番用

  results GachaResult[]
  owners  UserCard[]
}

model GachaResult {
  id           String   @id @default(cuid())
  userId       String
  cardId       String
  ticketId     String   @unique
  drawnAt      DateTime @default(now())
  streakAtDraw Int

  card    Card      @relation(fields: [cardId], references: [id])
  ticket  Ticket    @relation(fields: [ticketId], references: [id])
  firstOf UserCard?

  @@index([userId, drawnAt])
}

model UserCard {
  id             String  @id @default(cuid())
  userId         String
  cardId         String
  firstResultId  String  @unique
  viaHabitId     String?
  discoveryRank  Int
  personalReward String?

  card        Card        @relation(fields: [cardId], references: [id])
  firstResult GachaResult @relation(fields: [firstResultId], references: [id])
  viaHabit    Habit?      @relation(fields: [viaHabitId], references: [id])

  @@unique([userId, cardId])
  @@index([userId])
}
```

### 設計の意図

**保存するのは事実、計算するのは集計。**

| 項目 | 扱い | 理由 |
|---|---|---|
| 週の目標回数 | 保存しない | `daysOfWeek.length` から求まる |
| チケット残高 | 保存しない | `consumedAt IS NULL` の件数 |
| 全体ストリーク | 保存しない | `HabitLog` の日付から計算 |
| 習慣ごとのストリーク | 保存しない | `HabitLog` を週単位で集計 |
| 発見順位 | **保存する** | 挿入時点でしか確定できない |

**「1達成1チケット」は DB 制約で保証する。**
`Ticket.habitLogId` を一意にすることで、同一の達成記録から2枚目が発行されることを構造的に不可能にする。
1日3枚の上限は制約で表現できないため、トランザクション内で `earnedDate` の件数を数えて判定する。

**習慣は論理削除する。**
物理削除すると `UserCard.viaHabitId` の参照先が失われ、「このカードはどの習慣で出たか」の記録が消えるため。

**後から復元できない情報のみ、第1弾から記録する。**
発見順位、取得時のストリーク、きっかけとなった習慣、取得日時がこれに該当する。表示は第2弾でよい。
ジャンル・裏面の知識・画像・保有率は、後から追加しても既存データから復元できるため、第1弾では扱わない。

### 第2弾でのスキーマ変更

追加が必要なのは `Genre` テーブルと `Card.genreId` のみ。
既存データは1ジャンルに寄せるだけで、作り直しは発生しない。

---

## 9. ゲームバランス

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

## 10. 設計判断の根拠

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

## 11. 未確定事項

以下は未決定。決まり次第この文書に追記する。

- 画面ごとのデータフロー、DAL の関数一覧
- ガチャのトランザクション手順
- ストリーク計算の具体的なアルゴリズム
- エラー処理の方針
- テストの方針と範囲
- カードのテーマと40種の中身（「習慣の科学」は一例であり未決定）
- ストリークの表示形式

### 実装前に公式ドキュメントで確認すること

推測で実装しない箇所。

- Better Auth が生成するテーブルの構造と、`user` への項目追加方法
- Prisma 7 におけるスカラー配列（`Int[]`）と `@db.Date` の記法
- Prisma 7 のトランザクション API
- `opengraph-image.tsx` の記法と制約
