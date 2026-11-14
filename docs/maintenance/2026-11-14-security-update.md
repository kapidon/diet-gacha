# 2026-11-14 依存更新とセキュリティ確認

## 更新の目的

依存更新 PR の CI が脆弱性監査で失敗していた。
既知の脆弱性を修正し、更新で登録やチケットの並行制御が壊れないことを確認する。

## 選んだ更新

| 対象 | 更新前 | 更新後 |
|---|---|---|
| Next.js / eslint-config-next | 16.3.2 | 16.4.6 |
| React / React DOM | 19.2.8 | 19.3.1 |
| Prisma / Client / adapter-pg | 7.9.1 | 7.10.1 |
| Better Auth / auth CLI | 1.7.1 | 1.7.23 |
| Vitest | 4.1.11 | 4.1.12 |
| Tailwind CSS / PostCSS plugin | 4.3.3 | 4.3.5 |
| Node.js 型定義 | 26.2.0 | 24.19.2 |
| actions/setup-node | 7.0.0 | 7.1.0 |
| setup-takumi-guard-npm | 1.2.0 | 1.4.0 |

実行環境は Node.js 24.19.0 を維持し、型定義を24系へ合わせた。
新しい直接依存は追加していない。lockfile の HTTP 取得先はすべて `npm.flatt.tech`。
通常更新を Prisma、Next.js/React、Better Auth ごとにまとめる Dependabot 設定も追加した。

Next.js と React は同梱の更新ガイドに従って一緒に更新した。
根拠: `node_modules/next/dist/docs/01-app/01-getting-started/18-upgrading.md`。
[Next.js 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6)、
[Prisma 7.10.1](https://github.com/prisma/orm/releases/tag/7.10.1)、
[Better Auth 1.7.23](https://github.com/better-auth/better-auth/releases/tag/v1.7.23) のリリースを確認した。

Prisma の `latest` は 8.0.0-rc.33 を指していたため、安定版7系を採用した。
TypeScript 7、Vitest 5 のメジャー更新は互換性確認の範囲を分けるため保留した。
ESLint 9 は [サポート終了済み](https://eslint.org/version-support/) だが、
既存の `eslint-plugin-react@7.37.5` の peer dependency は9系までで、10系を含まない。
強制インストールはせず、プラグインの対応確認を次の更新条件とする。

## 更新で検出・修正した互換性問題

### Prisma の制約違反

adapter-pg 7.10.1 は `constraint.fields` より `constraint.index` を優先する。
実 DB で Prisma API と raw SQL のエラーを確認し、制約名の完全一致で分類するよう修正した。
制約名がない場合だけ列の組を使う。別の制約違反をリトライ対象と誤認しない実 DB テストを追加した。
重複チェックと異なる習慣の並行チェックも既存テストで確認した。

### Better Auth の旧 issuer 列

新規登録の HTTP 確認で500エラーを検出した。
1.7.0〜1.7.2 の必須 `account.issuer` 列に、1.7.3以降は値が書き込まれないためだった。

[公式ガイド](https://raw.githubusercontent.com/better-auth/better-auth/main/docs/content/docs/guides/1-7-upgrade-guide.mdx) は
nullable 化と旧インデックスの削除を案内している。
一般的にはこの手順に従うが、今回はメール・パスワード認証だけの構成であるため、
既存データとインデックスを維持し、`credential` の DB 既定値だけを追加した。
未使用の必須列へ既定値を設ける方法は、インストール済み Better Auth core のスキーマ検査でも許容されている。
他の認証方式を扱う変更では、旧列と旧インデックスを改めて整理する必要がある。

生成 SQL を全文確認し、以下の1文だけであることを確認してからローカルのテスト DB へ適用した。

```sql
ALTER TABLE "account" ALTER COLUMN "issuer" SET DEFAULT 'credential';
```

既存行の更新・削除、列の型変更はない。ローカルの `(providerId, accountId)` の重複は0件。
旧 issuer 値を持つアカウントのログインと、その値が保持されることもテストした。
本番 DB の確認・適用は行っていない。デプロイ前に本番の重複確認とマイグレーション適用が必要。

## 監査結果

| npm audit の分類 | 更新前 | 更新後 |
|---|---:|---:|
| critical | 2 | 0 |
| high | 11 | 0 |
| moderate | 9 | 7 |
| low | 2 | 0 |
| 合計 | 24 | 7 |

本番依存だけの `npm audit --omit=dev` は0件。
更新前はプロキシと npm 公式 API の両方へ照会し、同じ件数だった。

残る7件は `typescript-eslint` → `minimatch@10.2.6` の
[GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
という1つの指摘が開発依存に伝播したもの。
上流は `^10.2.2` を要求し、修正版は11.0.1のため、メジャーを跨ぐ `overrides` は加えなかった。
`npm audit fix --dry-run` の変更提案も0件だった。
これは未解消の指摘として保持し、上流の対応を追う。

high と critical が解消したため、CI の監査を `--audit-level=critical` から `--audit-level=high` へ強化した。
GitHub Actions の完全 SHA 固定を維持し、権限を `contents: read` に限定した。
GitHub 側では Dependabot 脆弱性アラート、セキュリティ更新、シークレット検出、push 保護を有効化した。

Git 履歴の163個の blob を、秘密鍵・GitHub/OpenAIトークン・AWSアクセスキーの代表的な形式で走査し、該当は検出しなかった。
これはパターン検索であり、すべての形式の秘密情報が存在しないことを保証するものではない。

## DB テストの保護とレビュー

TRUNCATE の許可条件を URL の部分一致から、ローカルホスト名と専用 DB 名の完全一致へ変更した。
接続先を上書きできるクエリパラメータを拒否し、エラーに接続 URL を含めない。
独立レビューで URL と pg の空白正規化の差を指摘され、空白・制御文字も拒否する修正と回帰テストを追加した。
DB テストは直列のプロジェクトへ分け、DB を使わないテストの並列実行は維持した。

制約違反の分類、認証スキーマ、認証テスト、CI 設定も独立レビューを受けた。
採用しなかった指摘はない。

## 検証範囲

- `npm ci` と postinstall の Prisma Client 生成: 成功。
- `npm run lint`: エラー0。既存のテスト内の非nullアサーション警告6件は残る。
- `npm run build`: 成功。ローカル未設定の `BETTER_AUTH_URL` について既存の警告あり。
- `npm test`: 実 PostgreSQL 18 を使う認証・認可・並行制御を含む74件。
- `npm audit --audit-level=high`: 成功。本番依存の監査は0件。
- 本番ビルドのローカル HTTP: 未ログイン時のリダイレクト、登録、ログイン、本人セッション、認証済み `/habits`、外部 origin のログイン拒否、ログアウト後の失効を確認。一時アカウントは削除した。
- 未実施: ブラウザ E2E、画面の目視確認、Neon / Vercel 上の検証、本番 DB への適用。他のリポジトリの依存監査。

判断が必要なこと: なし。
確信が持てていない箇所: 未実施の本番環境とブラウザ E2E は上記のとおり。
後から変えるコストが高い決定: なし。
