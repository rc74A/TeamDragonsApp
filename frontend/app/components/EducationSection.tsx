import { useEffect, useState, type FormEvent } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const HEADERS = { "Content-Type": "application/json", "X-User-Id": "1" };

interface Education {
  id: number;
  school: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  gpa: string;
  description: string;
  position: number;
}

const EMPTY_FORM = {
  school: "",
  degree: "",
  field_of_study: "",
  start_date: "",
  end_date: "",
  gpa: "",
  description: "",
};

export default function EducationSection() {
  const [entries, setEntries] = useState<Education[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await fetch(`${API_BASE}/api/education`, {
        headers: HEADERS,
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
    if (!form.school.trim()) {
      setError("School is required.");
      return;
    }
    if (!form.degree.trim()) {
      setError("Degree is required.");
      return;
    }
    const url = editingId
      ? `${API_BASE}/api/education/${editingId}`
      : `${API_BASE}/api/education`;
    const res = await fetch(url, {
      method: editingId ? "PUT" : "POST",
      headers: HEADERS,
      body: JSON.stringify(form),
    });
    if (res.ok) {
      resetForm();
      load();
    } else {
      setError("Could not save this record.");
    }
  }

  function startEdit(entry: Education) {
    setEditingId(entry.id);
    setError("");
    setForm({
      school: entry.school,
      degree: entry.degree,
      field_of_study: entry.field_of_study,
      start_date: entry.start_date,
      end_date: entry.end_date,
      gpa: entry.gpa,
      description: entry.description,
    });
  }

  async function handleDelete(id: number) {
    await fetch(`${API_BASE}/api/education/${id}`, {
      method: "DELETE",
      headers: HEADERS,
    });
    if (editingId === id) {
      resetForm();
    }
    load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= entries.length) {
      return;
    }
    const order = entries.map((entry) => entry.id);
    [order[index], order[target]] = [order[target], order[index]];
    await fetch(`${API_BASE}/api/education/reorder`, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ order }),
    });
    load();
  }

  return (
    <section className="settings-section" aria-labelledby="education-heading">
      <h3 id="education-heading">Education</h3>

      <ul className="education-list">
        {entries.length === 0 && (
          <li className="education-empty">No education records yet.</li>
        )}
        {entries.map((entry, index) => (
          <li key={entry.id} className="education-entry">
            <div className="education-info">
              <strong>{entry.school}</strong>
              {entry.degree && <span> — {entry.degree}</span>}
              <div className="education-meta">
                {entry.field_of_study && `${entry.field_of_study}`}
                {entry.gpa && ` · GPA ${entry.gpa}`}
                {(entry.start_date || entry.end_date) &&
                  ` · ${entry.start_date} – ${entry.end_date || "Present"}`}
              </div>
            </div>
            <div className="education-actions">
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
          <label htmlFor="edu_school">School</label>
          <input
            id="edu_school"
            type="text"
            value={form.school}
            onChange={(e) => setForm({ ...form, school: e.target.value })}
            placeholder="New Jersey Institute of Technology"
          />
        </div>
        <div className="field">
          <label htmlFor="edu_degree">Degree</label>
          <input
            id="edu_degree"
            type="text"
            value={form.degree}
            onChange={(e) => setForm({ ...form, degree: e.target.value })}
            placeholder="B.S. Computer Science"
          />
        </div>
        <div className="field">
          <label htmlFor="edu_field">Field of study</label>
          <input
            id="edu_field"
            type="text"
            value={form.field_of_study}
            onChange={(e) =>
              setForm({ ...form, field_of_study: e.target.value })
            }
            placeholder="Computer Science"
          />
        </div>
        <div className="field">
          <label htmlFor="edu_start">Start</label>
          <input
            id="edu_start"
            type="text"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            placeholder="Sep 2022"
          />
        </div>
        <div className="field">
          <label htmlFor="edu_end">End</label>
          <input
            id="edu_end"
            type="text"
            value={form.end_date}
            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            placeholder="Present"
          />
        </div>
        <div className="field">
          <label htmlFor="edu_gpa">GPA</label>
          <input
            id="edu_gpa"
            type="text"
            value={form.gpa}
            onChange={(e) => setForm({ ...form, gpa: e.target.value })}
            placeholder="3.8"
          />
        </div>
        <div className="field">
          <label htmlFor="edu_desc">Description</label>
          <textarea
            id="edu_desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editingId ? "Save changes" : "Add education"}
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
