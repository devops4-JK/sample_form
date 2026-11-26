import { useEffect } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import ProfileMenu from "./ProfileMenu";
import "../styles/admin.css";
import logo from "../images/Logo.png";


const ico = {
  width: 17,
  height: 17,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const UsersIcon = () => (
  <svg {...ico}>
    <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
    <circle cx="9" cy="7" r="3.5" />
    <path d="M22 20v-1.5a4 4 0 0 0-3-3.87" />
    <path d="M16 3.6a4 4 0 0 1 0 7.8" />
  </svg>
);

const ActivityIcon = () => (
  <svg {...ico}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M9.5 9.5V20" />
  </svg>
);

const linkClass = ({ isActive }) => (isActive ? "adm-link adm-link-on" : "adm-link");

/**
 * Admin header + fixed left nav + page body. Every route nested under it
 * renders in <Outlet />.
 *
 * The header is the same one the forms home draws — the brand on the left
 * and the account menu on the right — so an admin gets the same profile
 * panel, with light or dark and the accent colour, in both places. The
 * app's shared top bar steps aside while an admin page is open.
 */

export default function AdminLayout() {
  useEffect(() => {
    document.body.classList.add("adm-locked");
    return () => document.body.classList.remove("adm-locked");
  }, []);

  return (
    <div className="adm-shell">
      <header className="fx-topbar adm-top">
        {/* <Link to="/admin" className="brand">
          companystore<span className="brand-dot">.io</span>
        </Link> */}
         <Link to="/admin" className="brand">
            <img src={logo} alt="Company Store" className="brand-logo" />
         </Link>

        <ProfileMenu homeTo="/" />
      </header>

      <div className="adm">
        <aside className="adm-side">
          <p className="adm-side-label">Admin</p>

          <nav className="adm-nav">
            <NavLink to="/admin" end className={linkClass}>
              <UsersIcon />
              User access
            </NavLink>
            <NavLink to="/admin/activity" className={linkClass}>
              <ActivityIcon />
              Forms and activity
            </NavLink>
          </nav>
        </aside>

        <div className="adm-body">
          <Outlet />
        </div>
      </div>
    </div>
  );
}










