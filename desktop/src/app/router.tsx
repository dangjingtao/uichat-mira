import { createHashRouter } from "react-router-dom";
import App from "../App";
import { GuestOnly } from "./route-guards/GuestOnly";
import { RequireAuth } from "./route-guards/RequireAuth";
import ChatPage from "../features/chat/pages/ChatPage";
import LoginPage from "../features/auth/pages/LoginPage";
import BaseLayout from "@/app/layouts/BaseLayout";
import HomePage from "@/features/dashboard/pages/HomePage";
import About from "@/features/Settings/pages/About/index";
import GeneralSettings from "@/features/Settings/pages/General/index";
import AccountSettings from "@/features/Settings/pages/Account/index";
import KnowledgeBaseSettings from "@/features/Settings/pages/KnowledgeBase/index";
import KnowledgeBaseAddWizard from "@/features/Settings/pages/KnowledgeBase/Add";
import KnowledgeBaseDetail from "@/features/Settings/pages/KnowledgeBase/Detail";
import ModelSettings from "@/features/Settings/pages/ModelSetting";
import { RouteErrorBoundary } from "@/shared/ui/ErrorBoundary";

export const router = createHashRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomePage /> },
          {
            element: <BaseLayout />,
            children: [
              { path: "chat", element: <ChatPage /> },
              {
                path: "settings",
                children: [
                  { path: "general", element: <GeneralSettings /> },
                  { path: "account", element: <AccountSettings /> },
                  { path: "about", element: <About /> },
                  { path: "knowledge-base", element: <KnowledgeBaseSettings /> },
                  {
                    path: "knowledge-base/add",
                    element: <KnowledgeBaseAddWizard />,
                  },
                  {
                    path: "knowledge-base/detail",
                    element: <KnowledgeBaseDetail />,
                  },
                  { path: "model-setting", element: <ModelSettings /> },
                ],
              },
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
