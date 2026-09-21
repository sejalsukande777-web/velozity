import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { Dashboard } from "../types";

export default function DashboardPage() {
  const socket = useSocket();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  useEffect(() => {
    apiFetch("/dashboard").then(setDashboard);
  }, []);

  useEffect(() => {
    if (!socket) return;
    function handlePresence(payload: { onlineCount: number }) {
      setDashboard((prev) => (prev && prev.role === "ADMIN" ? { ...prev, onlineUserCount: payload.onlineCount } : prev));
    }
    socket.on("presence:update", handlePresence);
    return () => {
      socket.off("presence:update", handlePresence);
    };
  }, [socket]);

  if (!dashboard) return <p>Loading dashboard...</p>;

  if (dashboard.role === "ADMIN") {
    return (
      <div>
        <h1>Admin Dashboard</h1>
        <div className="stat-grid">
          <div className="card stat">
            <div className="stat-value">{dashboard.totalProjects}</div>
            <div className="muted">Total Projects</div>
          </div>
          <div className="card stat">
            <div className="stat-value">{dashboard.overdueCount}</div>
            <div className="muted">Overdue Tasks</div>
          </div>
          <div className="card stat">
            <div className="stat-value">{dashboard.onlineUserCount}</div>
            <div className="muted">Online Now</div>
          </div>
        </div>
        <div className="card">
          <h3>Tasks by Status</h3>
          <ul>
            {Object.entries(dashboard.tasksByStatus).map(([status, count]) => (
              <li key={status}>
                {status}: {count}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (dashboard.role === "PM") {
    return (
      <div>
        <h1>PM Dashboard</h1>
        <div className="card">
          <h3>Your Projects</h3>
          <ul>
            {dashboard.projectsSummary.map((p) => (
              <li key={p.id}>
                {p.name} — {p.taskCount} tasks
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Tasks by Priority</h3>
          <ul>
            {Object.entries(dashboard.tasksByPriority).map(([priority, count]) => (
              <li key={priority}>
                {priority}: {count}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3>Due This Week</h3>
          {dashboard.dueThisWeek.length === 0 && <p className="muted">Nothing due this week.</p>}
          <ul>
            {dashboard.dueThisWeek.map((t) => (
              <li key={t.id}>
                {t.title} — {t.priority} — due {new Date(t.dueDate).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // DEVELOPER
  return (
    <div>
      <h1>My Tasks</h1>
      <div className="card">
        <table className="task-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.tasks.map((t) => (
              <tr key={t.id} className={t.isOverdue ? "overdue-row" : ""}>
                <td>{t.title}</td>
                <td>{t.status}</td>
                <td>{t.priority}</td>
                <td>
                  {new Date(t.dueDate).toLocaleDateString()}
                  {t.isOverdue && <span className="overdue-tag"> OVERDUE</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
