import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { Role } from "@/types";

interface Props {
  children:      React.ReactNode;
  allowedRoles?: Role[];
}

/**
 * Protège une route :
 *   - Redirige vers /login si non connecté
 *   - Redirige vers /unauthorized si le rôle n'est pas autorisé
 */
export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isLoggedIn, role } = useAuthStore();

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
