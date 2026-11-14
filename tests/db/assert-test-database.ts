/** TRUNCATE を許す接続先は、compose.yaml / CI のローカル専用 DB だけ。 */
export function assertTestDatabase(connectionString: string) {
  // URL と pg で空白・制御文字の正規化が異なる。解釈の揺れる入力は拒否する。
  if (/[\s\p{Cc}]/u.test(connectionString)) {
    throw new Error('resetDb はローカルの diet_gacha_test 以外では実行しません')
  }

  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error('resetDb はローカルの diet_gacha_test 以外では実行しません')
  }

  // pg はクエリパラメータでも接続先を指定できるため、それらも受け付けない。
  const isLocalTestDb =
    (url.protocol === 'postgresql:' || url.protocol === 'postgres:') &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
    url.pathname === '/diet_gacha_test' &&
    url.search === '' &&
    url.hash === ''

  if (!isLocalTestDb) {
    // 接続 URL にはパスワードが含まれるので、失敗時も表示しない。
    throw new Error('resetDb はローカルの diet_gacha_test 以外では実行しません')
  }
}
