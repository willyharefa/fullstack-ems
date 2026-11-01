import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Loading from "./Loading";

// Membatasi halaman berdasarkan role. Ini hanya UX guard;
// otorisasi sebenarnya tetap dilakukan server.
export default function RequireRole({ allowedRoles, children }) {
    const { user, loading } = useAuth();

    if (loading) return <Loading />

    if (!user) return <Navigate to="/login" replace />

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}
