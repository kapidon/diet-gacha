/**
 * Better Auth のエラーコードを日本語のメッセージへ変換する。
 *
 * error.message ではなく error.code で分岐する。message はバージョンが
 * 上がると文言が変わりうるが、code は BASE_ERROR_CODES のキー名（英語の
 * 定数）で安定している。
 *
 * 実際にどのコードが返るかは、記憶ではなく次のファイルで確認した。
 * - node_modules/@better-auth/core/dist/error/codes.mjs
 *   （BASE_ERROR_CODES の定義。code はこのオブジェクトのキーと一致する。
 *   node_modules/@better-auth/core/dist/utils/error-codes.mjs の
 *   defineErrorCodes が `{ code: key, message: value }` を作っている）
 * - node_modules/better-auth/dist/api/routes/sign-up.mjs
 *   （PASSWORD_TOO_SHORT / PASSWORD_TOO_LONG / USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL
 *   を投げている箇所）
 * - node_modules/better-auth/dist/api/routes/sign-in.mjs
 *   （INVALID_EMAIL_OR_PASSWORD を投げている箇所。メール不明とパスワード不一致の
 *   どちらでも同じコードが返る）
 * - node_modules/@better-auth/core/dist/error/index.mjs
 *   （APIError.from が HTTP レスポンスボディを { message, code } で組み立てる
 *   ことの確認）
 *
 * login と signup の両方が参照する共有テーブルなので、最初から1箇所にまとめる
 * （AGENTS.md の「3回以上出てから共通化」は同じロジックが複数箇所で独立に育つ
 * ケース向けの基準で、これは1つのテーブルを2画面が参照するだけなので該当しない）。
 */

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // ログイン失敗はメール不明・パスワード不一致のどちらでも同じコードで返ってくる。
  // アカウントの存在が漏れないよう、あえて同じ文言に寄せる。
  INVALID_EMAIL_OR_PASSWORD: 'メールアドレスまたはパスワードが正しくありません',
  PASSWORD_TOO_SHORT: 'パスワードは8文字以上で入力してください',
  PASSWORD_TOO_LONG: 'パスワードは128文字以内で入力してください',
  USER_ALREADY_EXISTS: 'このメールアドレスは既に登録されています',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'このメールアドレスは既に登録されています',
  INVALID_EMAIL: 'メールアドレスの形式が正しくありません',
}

const FALLBACK_MESSAGE = 'エラーが発生しました。しばらくしてからもう一度お試しください'

/** 未知の code はフォールバック文言にする。握りつぶさず、必ず何か表示する。 */
export function authErrorMessage(error: { code?: string | null } | null | undefined): string {
  if (!error?.code) return FALLBACK_MESSAGE
  return AUTH_ERROR_MESSAGES[error.code] ?? FALLBACK_MESSAGE
}
