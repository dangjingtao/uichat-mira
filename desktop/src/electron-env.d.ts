declare global {
  interface Window {
    desktopApi?: {
      platform: string;
      isPackaged: boolean;
      backendUrl: string;
      checkBackendHealth: () => Promise<{
        success: boolean;
        statusCode: number;
        error?: string;
      }>;
      checkDatabaseHealth: () => Promise<{
        success: boolean;
        ok: boolean;
        configured: boolean;
        mode: string;
        detail: string;
      }>;
    };
  }
}

export {};
