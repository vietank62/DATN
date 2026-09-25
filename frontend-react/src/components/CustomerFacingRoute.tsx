import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { defaultRouteForRole } from "../utils/roleRoutes";

export function CustomerFacingRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (user?.role === "manager" || user?.role === "admin") {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}
