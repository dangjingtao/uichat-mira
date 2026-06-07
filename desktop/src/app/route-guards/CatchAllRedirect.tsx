import { Navigate } from "react-router-dom";

interface CatchAllRedirectProps {
  to: string;
}

export function CatchAllRedirect({ to }: CatchAllRedirectProps) {
  return <Navigate to={to} replace />;
}
