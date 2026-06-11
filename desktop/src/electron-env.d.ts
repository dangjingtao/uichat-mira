declare global {
  interface Window {
    desktopRuntime?: {
      hostKind: "browser" | "electron" | "tauri";
      platform: string;
      isPackaged: boolean;
      backendUrl: string;
    };
    desktopApi?: {
      platform: string;
      isPackaged: boolean;
      backendUrl: string;
    };
  }
}

export {};
