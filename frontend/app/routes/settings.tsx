import type { Route } from "./+types/settings";
import { getAuth } from "@clerk/react-router/server";
import { Link, redirect } from "react-router";
import { SignOutButton } from "@clerk/react-router";
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
  {
    title: "Appearance",
    description: "Light/Dark mode, and other custom appearance options.",
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

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw redirect("/login");
}

export default function Settings() {
  return (
    <div className="settings-root-layout profile-root">
      <h1 className="settings-top-bar profile-header">Dragon Application</h1>

      <div className="settings-split-pane profile-workspace">
        <aside className="sidebar">
          <ul>
            <li>
              <Link to="/" className="nav-link">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/findjobs" className="nav-link">
                Find Jobs
              </Link>
            </li>
            <li>
              <Link to="/profile" className="nav-link">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="nav-link-active">
                Settings
              </Link>
            </li>
            <li className="logout-item">
              <SignOutButton redirectUrl="/login">
                <button className="btn-logout">Sign Out</button>
              </SignOutButton>
            </li>
          </ul>
        </aside>

        <main className="settings-main-viewport profile-main">
          <div className="settings-constrained-box">
            <h2 className="view-title">Account Settings</h2>
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
        </main>
      </div>
    </div>
  );
}
