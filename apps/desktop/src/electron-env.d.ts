export {};

declare global {
  interface Window {
    desktopApi?: {
      platform: string;
      isPackaged: boolean;
      backendUrl: string;
      checkBackendHealth: () => Promise<{
        ok: boolean;
        statusCode: number;
        error?: string;
      }>;
      checkDatabaseHealth: () => Promise<{
        ok: boolean;
        configured: boolean;
        detail: string;
      }>;
    };
  }
}
