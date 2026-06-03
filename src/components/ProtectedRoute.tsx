import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { useProfile } from "@/contexts/AuthContext";
import { hasPermission, PATH_TO_SECTION } from "@/lib/auth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  const { permissions, isLoading } = useProfile();
  const location = useLocation();

  if (!isLoaded || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const section = PATH_TO_SECTION[location.pathname];
  if (section && !hasPermission(permissions, section, "view")) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
