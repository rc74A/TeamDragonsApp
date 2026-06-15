import {} from "react";
import { Link } from "react-router";
import "./app.css";
import "./settings.css";

/*
interface AccountSettings {
  displayName: string;
  email: string;
}
*/ 

const COMING_SOON = [
  { title: "Two-Factor Authentication (2FA)", description: "Secure your login sequence with an authenticator app token wrapper." },
  { title: "Webhook Notifications", description: "Dispatch raw JSON event frames to custom Discord or Slack endpoints on data mutations." }
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

  return (
    <div className="settings-root-layout">
      <header className="settings-top-bar">
        Dragon Application
      </header>

      <div className="settings-split-pane">
        <aside className="settings-sidebar-nav">
          <ul>
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/profile">Profile</Link></li>
            <li><Link to="/settings" className="active-link">Settings</Link></li>
          </ul>
        </aside>

        <main className="settings-main-viewport">
          <div className="settings-constrained-box">
            <h2 style={{ fontSize: "28px", fontWeight: "bold", margin: "0 0 4px 0" }}>Account Settings</h2>
            <p className="settings-subtitle">Manage your node credentials, security preferences, and system automation configurations.</p>

            <section className="settings-section">
              <h3>Security Extensions</h3>
              <ul className="coming-soon-list">
                {COMING_SOON.map((item, index) => (
                  <li key={index} className="coming-soon">
                    <div className="coming-soon-info">
                      <h4>{item.title}</h4>
                      <p>{item.description}</p>
                    </div>
                    <span className="badge">Coming soon</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}