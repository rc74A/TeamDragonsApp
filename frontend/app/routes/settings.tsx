import { requireAuth } from "../lib/auth";
import type { Route } from "./+types/settings";
import { useEffect, useState, type FormEvent } from "react";
import "./app.css";
import "./settings.css";

export async function loader({ request }: Route.LoaderArgs) {
  return await requireAuth(request);
}

const STORAGE_KEY = "tdAccountSettings";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AccountSettings = {
  displayName: string;
  email: string;
};

type FieldErrors = {
  displayName?: string;
  email?: string;
};

const COMING_SOON = [
  { title: "Security", description: "Password and login management." },
  { title: "Notifications", description: "Email and in-app alerts." },
  { title: "Appearance", description: "Theme and display preferences." },
];

function loadAccountSettings(): AccountSettings {
  if (typeof window === "undefined") {
    return { displayName: "", email: "" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { displayName: "", email: "" };
    }
    const parsed = JSON.parse(raw) as Partial<AccountSettings>;
    return { displayName: parsed.displayName ?? "", email: parsed.email ?? "" };
  } catch {
    return { displayName: "", email: "" };
  }
}

function validate(settings: AccountSettings): FieldErrors {
  const errors: FieldErrors = {};
  if (!settings.displayName.trim()) {
    errors.displayName = "Display name is required.";
  }
  if (!EMAIL_PATTERN.test(settings.email)) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

export default function Settings() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load persisted values after hydration. A lazy useState initializer
    // would read localStorage during the server render and cause a
    // hydration mismatch, so syncing here is intentional.
    const stored = loadAccountSettings();
    /* eslint-disable react-hooks/set-state-in-effect */
    setDisplayName(stored.displayName);
    setEmail(stored.email);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: AccountSettings = { displayName, email };
    const validationErrors = validate(next);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSaved(false);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
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
            </ul>
          </nav>
        </aside>

        <main className="main-content">
          <h2>Account Settings</h2>
          <p className="settings-subtitle">Manage your account settings.</p>

          <section
            className="settings-section"
            aria-labelledby="account-heading"
          >
            <h3 id="account-heading">Account</h3>
            <form className="settings-form" onSubmit={handleSave} noValidate>
              <div className="field">
                <label htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                {errors.displayName && (
                  <p role="alert" className="error-text">
                    {errors.displayName}
                  </p>
                )}
              </div>

              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                {errors.email && (
                  <p role="alert" className="error-text">
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Save
                </button>
                {saved && (
                  <span role="status" className="success-text">
                    Saved.
                  </span>
                )}
              </div>
            </form>
          </section>

          <section className="settings-section" aria-labelledby="more-heading">
            <h3 id="more-heading" className="visually-hidden">
              More settings
            </h3>
            <ul className="coming-soon-list">
              {COMING_SOON.map((item) => (
                <li
                  key={item.title}
                  className="coming-soon"
                  aria-disabled="true"
                >
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                  </div>
                  <span className="badge">Coming soon</span>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
