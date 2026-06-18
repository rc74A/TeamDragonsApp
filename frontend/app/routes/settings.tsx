import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import "./app.css";
import "./settings.css";

/*
interface AccountSettings {
  displayName: string;
  email: string;
}
*/

const COMING_SOON = [
  {
    title: "Two-Factor Authentication (2FA)",
    description:
      "Secure your login sequence with an authenticator app token wrapper.",
  },
  {
    title: "Webhook Notifications",
    description:
      "Dispatch raw JSON event frames to custom Discord or Slack endpoints on data mutations.",
  },
];

/*
function loadAccountSettings(): AccountSettings {
  if (typeof window === "undefined") {
    return { displayName: "Joshua Ware", email: "jware@njit.edu" };
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
*/

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
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }
  */

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
      } catch (err) {
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
    <div className="settings-root-layout profile-root">
      <h1 className="settings-top-bar profile-header">Dragon Application</h1>

      <div className="settings-split-pane profile-workspace">
        <aside className="settings-sidebar-nav profile-sidebar">
          <ul className="profile-nav-list">
            <li>
              <Link to="/" className="profile-nav-link">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/profile" className="profile-nav-link">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="profile-nav-link active">
                Settings
              </Link>
            </li>
          </ul>
        </aside>

        <main className="settings-main-viewport profile-main">
          {isLoadingAuth ? (
            <div className="settings-loading-container">
              <h2 className="settings-loading-text">
                Verifying secure session...
              </h2>
            </div>
          ) : (
            <div className="settings-constrained-box">
              <h2 className="settings-view-title">Account Settings</h2>
              <p className="settings-subtitle">
                Manage your node credentials, security preferences, and system
                automation configurations.
              </p>

              <section className="settings-section">
                <h3>Security Extensions</h3>
                <ul className="coming-soon-list">
                  {COMING_SOON.map((item, index) => (
                    <li key={index} className="coming-soon">
                      <div className="coming-soon-info">
                        <h4>{item.title}</h4>
                        <p>{item.description}</p>
                      </div>
                      <span className="badge">Coming Soon</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
