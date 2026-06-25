import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@clerk/react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

interface Skill {
  id: number;
  name: string;
  category: string;
  proficiency: string;
  position: number;
}

const EMPTY_FORM = {
  name: "",
  category: "",
  proficiency: "",
};

export default function SkillsSection() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<Skill[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/skills`, {
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
    if (!form.name.trim()) {
      setError("Skill name is required.");
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const url = editingId
        ? `${API_BASE}/api/skills/${editingId}`
        : `${API_BASE}/api/skills`;

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
        setError("Could not save this skill.");
      }
    } catch {
      setError("Could not save this skill.");
    }
  }

  function startEdit(entry: Skill) {
    setEditingId(entry.id);
    setError("");
    setForm({
      name: entry.name,
      category: entry.category,
      proficiency: entry.proficiency,
    });
  }

  async function handleDelete(id: number) {
    try {
      const token = await getToken();
      if (!token) return;

      await fetch(`${API_BASE}/api/skills/${id}`, {
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
      setError("Failed to delete this skill.");
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

      await fetch(`${API_BASE}/api/skills/reorder`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ order }),
      });
      load();
    } catch {
      setError("Failed to reorder skills.");
    }
  }

  return (
    <section className="settings-section" aria-labelledby="skills-heading">
      <h3 id="skills-heading">Skills</h3>

      <ul className="skill-list">
        {entries.length === 0 && (
          <li className="skill-empty">No skills yet.</li>
        )}
        {entries.map((entry, index) => (
          <li key={entry.id} className="skill-entry">
            <div className="skill-info">
              <strong>{entry.name}</strong>
              <div className="skill-meta">
                {entry.category && `${entry.category}`}
                {entry.category && entry.proficiency && " · "}
                {entry.proficiency && `${entry.proficiency}`}
              </div>
            </div>
            <div className="skill-actions">
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
          <label htmlFor="skill_name">Skill</label>
          <input
            id="skill_name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Python"
          />
        </div>
        <div className="field">
          <label htmlFor="skill_category">Category</label>
          <input
            id="skill_category"
            type="text"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Programming Language"
          />
        </div>
        <div className="field">
          <label htmlFor="skill_proficiency">Proficiency</label>
          <select
            id="skill_proficiency"
            value={form.proficiency}
            onChange={(e) => setForm({ ...form, proficiency: e.target.value })}
          >
            <option value="">Unspecified</option>
            {PROFICIENCY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingId ? "Save changes" : "Add skill"}
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
