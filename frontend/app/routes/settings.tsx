import { Link, useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  /* Commented out redundant state handlers to maintain clear linter parameters
  const [displayName, setDisplayName] = useState("Test User");
  const [email, setEmail] = useState("test@email.com");
  const [isSaved, setIsSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.localStorage.setItem("account_settings", JSON.stringify({ displayName, email }));
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(true);
  }

  useEffect(() => {
    async function verifySession() {
      const BACKEND_URL =
        import.meta.env.VITE_ATS_API_URL ?? "http://localhost:8000";
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include", // Passes cookie securely across local ports
        });

        if (!response.ok) {
          // Cookie missing or invalid -> Kick out to login page
          navigate("/login", { replace: true });
        } else {
          setIsLoadingAuth(false); // Valid user session -> lift the curtain
        }
      } catch {
        // Backend offline/network error -> Safe fallback kick
        navigate("/login", { replace: true });
      }
    }

    verifySession();
  }, [navigate]);

  if (isLoadingAuth) {
    return (
      <div
        className="settings-root-layout"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <h2 style={{ color: "#06B6D4", fontFamily: "sans-serif" }}>
          Verifying secure session...
        </h2>
      </div>
    );
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
