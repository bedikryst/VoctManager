/// <reference types="google.maps" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_MAPS_FRONTEND_KEY: string;
  readonly VITE_GOOGLE_MAP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Native CloseWatcher API definition (Chrome 120+)
 * Handles hardware back-button and ESC key routing automatically.
 */
declare global {
  class CloseWatcher {
    constructor(options?: { signal?: AbortSignal });
    oncancel: ((this: CloseWatcher, ev: Event) => any) | null;
    onclose: ((this: CloseWatcher, ev: Event) => any) | null;
    requestClose(): void;
    close(): void;
    destroy(): void;
  }
}
