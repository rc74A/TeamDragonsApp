import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface Experience {
  id: number;
  entry_type: string;
  title: string;
  organization: string;
  start_date: string;
  end_date: string;
  description: string;
  position: number;
}

const EMPTY_FORM = {
  entry_type: "employment",
  title: "",
  organization: "",
  start_date: "",
  end_date: "",
  description: "",
};

export default function ExperienceSection() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<Experience[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/experience`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEntries(data);
        }
      }
    } catch {
      // Backend offline: keep the current list so the page still renders.
    }
  }

  useEffect(() => {
    // load() only sets state after an awaited fetch (async), not
    // synchronously — the standard on-mount data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const url = editingId
        ? `${API_BASE}/api/experience/${editingId}`
        : `${API_BASE}/api/experience`;

      const res = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        resetForm();
        load();
      } else {
        setError("Could not save this entry.");
      }
    } catch {
      setError("Could not save this entry.");
    }
  }

  function startEdit(entry: Experience) {
    setEditingId(entry.id);
    setError("");
    setForm({
      entry_type: entry.entry_type,
      title: entry.title,
      organization: entry.organization,
      start_date: entry.start_date,
      end_date: entry.end_date,
      description: entry.description,
    });
  }

  async function handleDelete(id: number) {
    try {
      const token = await getToken();
      if (!token) return;

      await fetch(`${API_BASE}/api/experience/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (editingId === id) {
        resetForm();
      }
      load();
    } catch {
      setError("Failed to execute deletion loop.");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) {
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const order = entries.map((entry) => entry.id);
      [order[index], order[target]] = [order[target], order[index]];

      await fetch(`${API_BASE}/api/experience/reorder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order }),
      });
      load();
    } catch {
      setError("Failed to process layout shift.");
    }
  }

  return (
    <section className="settings-section" aria-labelledby="experience-heading">
      <h3 id="experience-heading">Experience</h3>

      <ul className="experience-list">
        {entries.length === 0 && (
          <li className="experience-empty">No experience entries yet.</li>
        )}
        {entries.map((entry, index) => (
          <li key={entry.id} className="experience-entry">
            <div className="experience-info">
              <strong>{entry.title}</strong>
              {entry.organization && <span> — {entry.organization}</span>}
              <div className="experience-meta">
                {entry.entry_type}
                {(entry.start_date || entry.end_date) &&
                  ` · ${entry.start_date} – ${entry.end_date || "Present"}`}
              </div>
            </div>
            <div className="experience-actions">
              <button
                type="button"
                onClick={() => move(index, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button type="button" onClick={() => startEdit(entry)}>
                Edit
              </button>
              <button type="button" onClick={() => handleDelete(entry.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <form className="settings-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="exp_title">Title</label>
          <input
            id="exp_title"
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Software Engineer"
          />
        </div>
        <div className="field">
          <label htmlFor="exp_org">Organization</label>
          <input
            id="exp_org"
            type="text"
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            placeholder="Acme Inc."
          />
        </div>
        <div className="field">
          <label htmlFor="exp_type">Type</label>
          <select
            id="exp_type"
            value={form.entry_type}
            onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
          >
            <option value="employment">Employment</option>
            <option value="project">Project</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="exp_start">Start</label>
          <input
            id="exp_start"
            type="text"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            placeholder="Jan 2024"
          />
        </div>
        <div className="field">
          <label htmlFor="exp_end">End</label>
          <input
            id="exp_end"
            type="text"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            placeholder="Present"
          />
        </div>
        <div className="field">
          <label htmlFor="exp_desc">Description</label>
          <textarea
            id="exp_desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingId ? "Save changes" : "Add experience"}
          </button>
          {editingId !== null && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
