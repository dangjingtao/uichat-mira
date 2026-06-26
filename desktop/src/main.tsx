import React from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./shared/i18n";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import "react-tooltip/dist/react-tooltip.css";
import "streamdown/styles.css";
import "./styles.css";
import { ErrorBoundary } from "./shared/ui/ErrorBoundary";
import { MessageProvider } from "./shared/ui/Message";
import { ModalProvider } from "./shared/ui/Modal";
import { AuthProvider } from "./app/providers/AuthProvider";
import { LanguageProvider } from "./app/providers/LanguageProvider";
import { RoleModelConfigProvider } from "./app/providers/RoleModelConfigProvider";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { appPackageMeta } from "./shared/appMeta";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

declare global {
  interface Window {
    __uichatRoot?: Root;
  }
}

const Main = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <RoleModelConfigProvider>
                <ModalProvider>
                  <MessageProvider>
                    <RouterProvider router={router} />
                  </MessageProvider>
                </ModalProvider>
              </RoleModelConfigProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

const appRoot = window.__uichatRoot ?? createRoot(root);
window.__uichatRoot = appRoot;
appRoot.render(<Main />);

document.title = appPackageMeta.displayName;
