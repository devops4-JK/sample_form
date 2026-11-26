import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";

/**
 * Guards a group of routes.
 * `role` restricts to one role; leave it out to allow any logged-in account.
 */
export default function ProtectedRoute({ role }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for the session check, otherwise a page refresh bounces the user
  // back to the login screen before the token has been verified.
  if (loading) {
    return (
      <div className="route-loading">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}