/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_WA_MODE?: string;
  readonly VITE_WA_PHONE_NUMBER_ID?: string;
  readonly VITE_WA_ACCESS_TOKEN?: string;
  readonly VITE_WA_FROM_PHONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
