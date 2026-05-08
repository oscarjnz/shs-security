import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission, PATH_TO_SECTION } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { user, permissions, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const section = PATH_TO_SECTION[location.pathname];
  if (section && !hasPermission(permissions, section, "view")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
