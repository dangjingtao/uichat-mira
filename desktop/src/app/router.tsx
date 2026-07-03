import { createHashRouter } from "react-router-dom";
import App from "../App";
import { GuestOnly } from "./route-guards/GuestOnly";
import { RequireAuth } from "./route-guards/RequireAuth";
import LoginPage from "../features/auth/pages/LoginPage";
import BaseLayout from "@/app/Layouts/BaseLayout";
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
            path: "chat",
            element: <BaseLayout />,
          },
          {
            path: "settings",
            element: <BaseLayout />,
            children: settingsRoutes,
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
