import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "@assistant-ui/react-ui/styles/index.css";
import "@assistant-ui/react-ui/styles/markdown.css";
import "@assistant-ui/react-ui/styles/themes/default.css";
import "./styles.css";
import { ErrorBoundary } from "./shared/ui/ErrorBoundary";
import { MessageProvider } from "./shared/ui/Message";
import { ModalProvider } from "./shared/ui/Modal";
const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

const Main = () => {
  return (
    <React.StrictMode>
      <ErrorBoundary>
        <ModalProvider>
          <MessageProvider>
            <RouterProvider router={router} />
          </MessageProvider>
        </ModalProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

createRoot(root).render(<Main />);
