import React from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "@assistant-ui/react-ui/styles/index.css";
import "@assistant-ui/react-ui/styles/markdown.css";
import "@assistant-ui/react-ui/styles/themes/default.css";
import "./styles.css";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element not found");
}

const Main = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <React.StrictMode>
      {/* <AssistantRuntimeProvider runtime={runtime}> */}
      <RouterProvider router={router} />
      {/* </AssistantRuntimeProvider> */}
    </React.StrictMode>
  );
};

createRoot(root).render(<Main />);
