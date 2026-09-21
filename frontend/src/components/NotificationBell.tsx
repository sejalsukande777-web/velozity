import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { Notification } from "../types";

export default function NotificationBell() {
  const socket = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch("/notifications").then((data) => {
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleNew(payload: { notification: Notification; unreadCount: number }) {
      setNotifications((prev) => [payload.notification, ...prev]);
      setUnreadCount(payload.unreadCount);
    }

    socket.on("notification:new", handleNew);
    return () => {
      socket.off("notification:new", handleNew);
    };
  }, [socket]);

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await apiFetch("/notifications/read-all", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div className="notification-bell">
      <button className="bell-button" onClick={() => setOpen((o) => !o)}>
        🔔{unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <strong>Notifications</strong>
            <button className="link-button" onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          {notifications.length === 0 && <p className="muted">No notifications yet.</p>}
          <ul className="notification-list">
            {notifications.map((n) => (
              <li key={n.id} className={n.isRead ? "read" : "unread"} onClick={() => !n.isRead && markRead(n.id)}>
                {n.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
