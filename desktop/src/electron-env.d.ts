import { success } from "@/utils/index.js";

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
        configured: boolean;
        detail: string;
      }>;
    };
  }
}
