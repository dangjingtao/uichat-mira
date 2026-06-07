import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { FullPageStatus } from "../../shared/ui/FullPageStatus";

export function GuestOnly() {
  const { session, isCheckingSession } = useAuth();

  if (isCheckingSession) {
    return <FullPageStatus message="正在校验登录状态..." />;
  }

  if (session) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
}
