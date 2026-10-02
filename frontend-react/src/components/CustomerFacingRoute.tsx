import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { defaultRouteForRole } from "../utils/roleRoutes";

export function CustomerFacingRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-label="Đang tải phiên đăng nhập">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-red-500" />
      </div>
    );
  }

  if (user?.role === "manager" || user?.role === "admin") {
    return <Navigate to={defaultRouteForRole(user.role)} replace />;
  }

  return <Outlet />;
}
