import { useEffect, useState, type FormEvent } from "react";
import "./app.css";
import "./profile.css";

const API_BASE = import.meta.env.VITE_ATS_API_URL ?? "http://localhost:8000";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
};

const EMPTY_PROFILE: ProfileForm = {
  full_name: "",
  email: "",
  phone: "",
  location: "",
  summary: "",
};

/**
 * Resolve the current user's id for ownership-scoped requests.
 *
 * Placeholder until real sessions land (S1-011/S1-015): mirrors the
 * backend's X-User-Id approach by reading an id stored at login.
 */
function currentUserId(): string {
  if (typeof window === "undefined") {
    return "1";
  }
  return window.localStorage.getItem("userId") ?? "1";
}

export default function Profile() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/profile`, {
      headers: { "X-User-Id": currentUserId() },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) {
          setForm({
            full_name: data.full_name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            location: data.location ?? "",
            summary: data.summary ?? "",
          });
        }
      })
      .catch(() => {
        // Backend unreachable: keep the empty form so the page still renders.
      });
    return () => {
      active = false;
    };
  }, []);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus("idle");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.email && !EMAIL_PATTERN.test(form.email)) {
      setEmailError("Enter a valid email address.");
      setStatus("idle");
      return;
    }
    setEmailError(null);
    try {
      const res = await fetch(`${API_BASE}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": currentUserId(),
        },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="page-container">
      <header className="banner">
        <h1>Dragon Application</h1>
      </header>

      <div className="content-layout">
        <aside className="sidebar">
          <nav>
            <ul className="menu-list">
              <li>
                <a href="/">Dashboard</a>
              </li>
              <li>
                <a href="/profile">Profile</a>
              </li>
              <li>
                <a href="/settings">Settings</a>
              </li>
              <li>
                <a href="/login">Login</a>
              </li>
              <li>
                <a href="/register">Register</a>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="main-content">
          <h2>Profile</h2>
          <p className="profile-subtitle">
            Your identity, contact details, and summary.
          </p>

          <form className="profile-form" onSubmit={handleSave} noValidate>
            <div className="field">
              <label htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={form.full_name}
                onChange={(event) => updateField("full_name", event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
              />
              {emailError && (
                <p role="alert" className="error-text">
                  {emailError}
                </p>
              )}
            </div>

            <div className="field">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                type="text"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="summary">Summary</label>
              <textarea
                id="summary"
                name="summary"
                rows={4}
                value={form.summary}
                onChange={(event) => updateField("summary", event.target.value)}
              />
            </div>

            <div className="form-actions">
              <button type="submit">Save profile</button>
              {status === "saved" && (
                <span role="status" className="success-text">
                  Profile saved.
                </span>
              )}
              {status === "error" && (
                <span role="alert" className="error-text">
                  Could not save. Try again.
                </span>
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
