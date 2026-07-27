"use client";

import { useLocation } from "react-router-dom";
import { ChatWorkspace } from "./ChatWorkspace";
import {
  ChatRouteModelConfigRefresher,
} from "./chatRuntime";
import { SettingsWorkspace } from "./SettingsWorkspace";
import { DashboardWorkspace } from "./DashboardWorkspace";

/**
 * AppWorkspaceLayout is the authenticated shell that orchestrates long-lived
 * workspaces. The old "BaseLayout" name is kept at the route boundary for now
 * to avoid churn in imports, but this file no longer owns all implementation.
 */
function AppWorkspaceLayout() {
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isDashboardRoute = location.pathname === "/dashboard";

  return (
    <>
      <ChatRouteModelConfigRefresher />
      <ChatWorkspace visible={!isSettingsRoute && !isDashboardRoute} />
      <SettingsWorkspace visible={isSettingsRoute} />
      <DashboardWorkspace visible={isDashboardRoute} />
    </>
  );
}

export default AppWorkspaceLayout;
