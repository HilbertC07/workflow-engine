/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端地址，如 http://localhost:8080。不设则代码内用默认值 */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
