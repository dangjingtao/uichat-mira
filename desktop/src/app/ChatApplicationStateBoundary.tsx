"use client";

import { Outlet } from "react-router-dom";
import { useAuth } from "@/app/providers/AuthProvider";
import { AppChatRuntimeProvider } from "@/features/chat/core/runtime";

// ChatApplicationStateBoundary keeps one UChat runtime for the authenticated
// user while child workspace routes mount and unmount their visible surfaces.
export function ChatApplicationStateBoundary() {
  const { session } = useAuth();

  if (!session) {
    return <Outlet />;
  }

  return (
    <AppChatRuntimeProvider sessionKey={session.user.id}>
      <Outlet />
    </AppChatRuntimeProvider>
  );
}
