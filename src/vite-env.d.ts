/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 로컬 빠른 로그인용 시드 계정 비밀번호. .env.local에만 둔다. */
  readonly VITE_DEV_LOGIN_PASSWORD?: string
}
