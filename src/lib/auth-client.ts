import { createAuthClient } from 'better-auth/react'

// baseURL は渡さない。ブラウザでは window.location.origin にフォールバックするため
// （node_modules/better-auth/dist/utils/url.mjs の getBaseURL）、
// 環境ごとの URL をクライアントバンドルに埋め込まずに済む。
export const authClient = createAuthClient()
