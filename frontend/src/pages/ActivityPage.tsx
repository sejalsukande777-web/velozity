import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { ActivityItem } from "../types";

export default function ActivityPage() {
  const socket = useSocket();
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    apiFetch("/activity?limit=20").then((data) => setActivity(data.activity));
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleNew(payload: ActivityItem) {
      setActivity((prev) => {
        if (prev.some((a) => a.id === payload.id)) return prev; // avoid duplicates on reconnect overlap
        return [payload, ...prev];
      });
    }

    socket.on("activity:new", handleNew);
    return () => {
      socket.off("activity:new", handleNew);
    };
  }, [socket]);

  return (
    <div>
      <h1>Activity Feed</h1>
      <div className="card">
        {activity.length === 0 && <p className="muted">No activity yet.</p>}
        <ul className="activity-list">
          {activity.map((a) => (
            <li key={a.id}>{a.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
