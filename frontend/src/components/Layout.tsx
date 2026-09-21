import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-title">Velozity</div>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          {(user?.role === "ADMIN" || user?.role === "PM") && <NavLink to="/projects">Projects</NavLink>}
          <NavLink to="/activity">Activity</NavLink>
        </nav>
        <div className="header-right">
          <NotificationBell />
          <span className="muted">
            {user?.name} ({user?.role})
          </span>
          <button className="link-button" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
