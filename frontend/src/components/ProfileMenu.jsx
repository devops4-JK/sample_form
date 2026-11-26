import { forwardRef } from "react";
import { createPortal } from "react-dom";
import { Dropdown } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

/**
 * The account menu in the top-right corner: who is signed in, a way back to
 * the home page, light or dark, and Log out.
 *
 * It lives here rather than inside one page so every signed-in screen shows
 * exactly the same menu. Its styling is in styles/builder.css, the app's one
 * stylesheet.
 */

const PATHS = {
  home: ["M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"],
  sun: [
    "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  ],
  moon: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"],
  check: ["m5 12 5 5 9-10"],
  logout: [
    "M15 17v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v2",
    "M10 12h11",
    "m18 9 3 3-3 3",
  ],
};

function Icon({ name, size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

/**
 * Bootstrap passes its own className, which draws a caret; it is dropped
 * here on purpose so the avatar stays clean.
 */
const Trigger = forwardRef(function Trigger(
  // eslint-disable-next-line no-unused-vars
  { onClick, label, children, className, ...rest },
  ref
) {
  return (
    <button
      type="button"
      ref={ref}
      className="fx-avatar"
      aria-label={label}
      title={label}
      aria-expanded={rest["aria-expanded"]}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </button>
  );
});

/** The menu renders into <body>, so no card or scroller can clip it. */
function Menu(props) {
  return createPortal(<Dropdown.Menu {...props} />, document.body);
}

export default function ProfileMenu({ homeTo = "/" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const initial = initialOf(user?.name);

  return (
    <Dropdown align="end" autoClose="outside">
      <Dropdown.Toggle as={Trigger} label="Account menu">
        {initial}
      </Dropdown.Toggle>

      <Menu className="fx-menu fx-profile">
        <div className="fx-profile-id">
          <span className="fx-avatar fx-avatar-lg" aria-hidden="true">
            {initial}
          </span>
          <span className="fx-profile-text">
            <strong>{user?.name || "Signed in"}</strong>
            <small>{user?.email || ""}</small>
          </span>
        </div>

        <div className="fx-profile-group">
          <button type="button" className="fx-profile-row" onClick={() => navigate(homeTo)}>
            <Icon name="home" />
            Home page
          </button>
        </div>

        <div className="fx-profile-group">
          <span className="fx-menu-label">Appearance</span>
          <div className="fx-theme">
            <button
              type="button"
              className={theme === "light" ? "fx-theme-btn is-on" : "fx-theme-btn"}
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
            >
              <Icon name="sun" size={15} />
              Light
            </button>
            <button
              type="button"
              className={theme === "dark" ? "fx-theme-btn is-on" : "fx-theme-btn"}
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              <Icon name="moon" size={15} />
              Dark
            </button>
          </div>
        </div>

        <div className="fx-profile-group">
          <button
            type="button"
            className="fx-profile-row fx-danger"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </Menu>
    </Dropdown>
  );
}