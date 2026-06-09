declare global {
  interface Window {
    desktopApi?: {
      platform: string;
      isPackaged: boolean;
      backendUrl: string;
      checkBackendHealth: (token?: string) => Promise<{
        success: boolean;
        statusCode: number;
        error?: string;
      }>;
      checkDatabaseHealth: (token?: string) => Promise<{
        success: boolean;
        ok: boolean;
        configured: boolean;
        mode: string;
        detail: string;
        vectorStore: {
          ok: boolean;
          provider: "sqlite-vec";
          detail: string;
          extensionPath?: string;
        };
      }>;
    };
  }
}

export {};
