import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";

export default function Layout() {
  /* Turns on the app look (styles/app-ui.css) for every page inside the
     app. The published form route sits outside Layout, so it never gets
     the flag and keeps its own look. */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-ui", "app");
    return () => root.removeAttribute("data-ui");
  }, []);

  return (
    <div className="app-shell">
      <TopNav />
      <main className="app-main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}