import { createHashRouter } from "react-router-dom";
import App from "../App";
import { GuestOnly } from "./route-guards/GuestOnly";
import { RequireAuth } from "./route-guards/RequireAuth";
import ChatPage from "../features/chat/pages/ChatPage";
import LoginPage from "../features/auth/pages/LoginPage";
import BaseLayout from "@/app/layouts/BaseLayout";
import HomePage from "@/features/dashboard/pages/HomePage";
import { RouteErrorBoundary } from "@/shared/ui/ErrorBoundary";
import { settingsRoutes } from "@/app/routes/settingsRoutes";

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
                children: settingsRoutes,
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
