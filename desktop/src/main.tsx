import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./shared/i18n";
import "@assistant-ui/react-ui/styles/index.css";
import "@assistant-ui/react-ui/styles/markdown.css";
import "@assistant-ui/react-ui/styles/themes/default.css";
import "react-tooltip/dist/react-tooltip.css";
import "./styles.css";
import { ErrorBoundary } from "./shared/ui/ErrorBoundary";
import { MessageProvider } from "./shared/ui/Message";
import { ModalProvider } from "./shared/ui/Modal";
import { AuthProvider } from "./app/providers/AuthProvider";
import { LanguageProvider } from "./app/providers/LanguageProvider";
import { RoleModelConfigProvider } from "./app/providers/RoleModelConfigProvider";
import { ThemeProvider } from "./app/providers/ThemeProvider";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
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

createRoot(root).render(<Main />);
