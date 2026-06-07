import { createHashRouter } from "react-router-dom";
import App from "../App";
import { GuestOnly } from "./route-guards/GuestOnly";
import { RequireAuth } from "./route-guards/RequireAuth";
import ChatPage from "../features/chat/pages/ChatPage";
import LoginPage from "../features/auth/pages/LoginPage";
import BaseLayout from "@/app/Layouts/BaseLayout";
import HomePage from "@/features/dashboard/pages/HomePage";
import About from "@/features/Settings/pages/About/index";
import GeneralSettings from "@/features/Settings/pages/General/index";
import AccountSettings from "@/features/Settings/pages/Account/index";
import KnowledgeBaseSettings from "@/features/Settings/pages/KnowledgeBase/index";
import ModelSettings from "@/features/Settings/pages/ModelSetting";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          {
            path: "chat",
            element: (
              <BaseLayout mode="chat">
                <ChatPage />
              </BaseLayout>
            ),
          },
          {
            path: "settings",
            element: <BaseLayout mode="settings" />,
            children: [
              { path: "general", element: <GeneralSettings /> },
              { path: "account", element: <AccountSettings /> },
              { path: "about", element: <About /> },
              { path: "knowledge-base", element: <KnowledgeBaseSettings /> },
              { path: "model-setting", element: <ModelSettings /> },
            ],
          },
        ],
      },
      {
        element: <GuestOnly />,
        children: [{ path: "login", element: <LoginPage /> }],
      },
    ],
  },
]);
