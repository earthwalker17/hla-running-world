/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_SECURITY_CODE?: string;
  readonly VITE_ENABLE_REMOTE_ROADSHOW_API?: string;
  readonly VITE_DISABLE_REMOTE_ROADSHOW_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
