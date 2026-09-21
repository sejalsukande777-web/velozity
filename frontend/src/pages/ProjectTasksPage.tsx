import { useEffect, useState, FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Task, User, TaskStatus, Priority } from "../types";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");

  const status = searchParams.get("status") || "";
  const priorityFilter = searchParams.get("priority") || "";
  const dueFrom = searchParams.get("dueFrom") || "";
  const dueTo = searchParams.get("dueTo") || "";

  function loadTasks() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priorityFilter) params.set("priority", priorityFilter);
    if (dueFrom) params.set("dueFrom", dueFrom);
    if (dueTo) params.set("dueTo", dueTo);

    apiFetch(`/projects/${projectId}/tasks?${params.toString()}`).then((data) => setTasks(data.tasks));
  }

  useEffect(() => {
    loadTasks();
    apiFetch("/users?role=DEVELOPER").then((data) => setDevelopers(data.users));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, status, priorityFilter, dueFrom, dueTo]);

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title, assignedToId, priority, dueDate }),
      });
      setTitle("");
      setAssignedToId("");
      setPriority("MEDIUM");
      setDueDate("");
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    }
  }

  async function updateStatus(task: Task, newStatus: TaskStatus) {
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task.");
    }
  }

  const canManage = user?.role === "ADMIN" || user?.role === "PM";

  return (
    <div>
      <h1>Tasks</h1>

      <div className="card">
        <h3>Filters</h3>
        <div className="inline-form">
          <select value={status} onChange={(e) => updateFilter("status", e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={priorityFilter} onChange={(e) => updateFilter("priority", e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label>
            From <input type="date" value={dueFrom} onChange={(e) => updateFilter("dueFrom", e.target.value)} />
          </label>
          <label>
            To <input type="date" value={dueTo} onChange={(e) => updateFilter("dueTo", e.target.value)} />
          </label>
        </div>
      </div>

      {canManage && (
        <div className="card">
          <h3>New Task</h3>
          <form className="inline-form" onSubmit={handleCreate}>
            <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} required>
              <option value="">Assign to...</option>
              {developers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
            <button type="submit">Create</button>
          </form>
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <table className="task-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Assigned To</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={t.isOverdue ? "overdue-row" : ""}>
                <td>{t.title}</td>
                <td>{t.assignedTo?.name}</td>
                <td>{t.priority}</td>
                <td>
                  {new Date(t.dueDate).toLocaleDateString()}
                  {t.isOverdue && <span className="overdue-tag"> OVERDUE</span>}
                </td>
                <td>
                  <select value={t.status} onChange={(e) => updateStatus(t, e.target.value as TaskStatus)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && <p className="muted">No tasks match these filters.</p>}
      </div>
    </div>
  );
}
