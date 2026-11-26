import { Container, Navbar } from "react-bootstrap";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import logo from "../images/Logo.png";

function SunIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

const linkClass = ({ isActive }) => (isActive ? "top-link top-link-on" : "top-link");

export default function TopNav() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nextTheme = theme === "light" ? "dark" : "light";

  const handleLogout = () => {
    logout();
    // The name disappears with the user, and the Log in button takes its place.
    navigate("/");
  };

  const home = user ? "/forms" : "/";

  return (
    <Navbar as="header" className="top-nav">
      <Container fluid className="px-3 px-md-4">
        <Link to={home} className="brand">
          <img src={logo} alt="Company Store" className="brand-logo" />
        </Link>


        <div className="nav-actions ms-auto">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
            title={`Switch to ${nextTheme} mode`}
          >
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>

          {user ? (
            <>
              {/* Clicking the name opens the forms home. */}
              <button
                type="button"
                className="who who-btn d-none d-sm-inline"
                onClick={() => navigate(home)}
                title="Go to your home page"
              >
                {user.name}
              </button>
              <button type="button" className="btn btn-brand" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-brand"
              onClick={() => navigate("/login")}
            >
              Log in
            </button>
          )}
        </div>
      </Container>
    </Navbar>
  );
}