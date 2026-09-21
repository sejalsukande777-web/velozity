import { useEffect, useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { Project, Client } from "../types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadProjects() {
    apiFetch("/projects").then((data) => setProjects(data.projects));
  }

  useEffect(() => {
    loadProjects();
    apiFetch("/clients").then((data) => setClients(data.clients));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch("/projects", {
        method: "POST",
        body: JSON.stringify({ name, clientId }),
      });
      setName("");
      setClientId("");
      loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
    }
  }

  return (
    <div>
      <h1>Projects</h1>

      <div className="card">
        <h3>New Project</h3>
        <form className="inline-form" onSubmit={handleCreate}>
          <input placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} required />
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} required>
            <option value="">Select client...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit">Create</button>
        </form>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="card">
        <table className="task-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Client</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.client?.name}</td>
                <td>
                  <Link to={`/projects/${p.id}/tasks`}>View tasks</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
