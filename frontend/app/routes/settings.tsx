import type { Route } from "./+types/settings";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import "./settings.css";

interface AccountSettings {
  displayName: string;
  email: string;
}

const COMING_SOON = [
  { title: "Two-Factor Authentication (2FA)", description: "Secure your login sequence with an authenticator app token wrapper." },
  { title: "Webhook Notifications", description: "Dispatch raw JSON event frames to custom Discord or Slack endpoints on data mutations." }
];

function loadAccountSettings(): AccountSettings {
  if (typeof window === "undefined") {
    return { displayName: "Joshua Ware", email: "jware@njit.edu" };
  }
  const stored = window.localStorage.getItem("account_settings");
  return stored ? JSON.parse(stored) : { displayName: "Joshua Ware", email: "jware@njit.edu" };
}

export default function Settings() {
  const [displayName, setDisplayName] = useState("Joshua Ware");
  const [email, setEmail] = useState("jware@njit.edu");
  const [isSaved, setIsSaved] = useState(false);

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (typeof window !== "undefined") {
      window.localStorage.setItem("account_settings", JSON.stringify({ displayName, email }));
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }

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
            <p className="settings-subtitle">Manage your node credentials, email routing options, and display configurations.</p>

            <section className="settings-section">
              <h3>Profile Settings</h3>
              <form onSubmit={handleSave} className="settings-form">
                <div className="field">
                  <label>Display Name</label>
                  <input 
                    type="text" 
                    title="Display Name" 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                  />
                </div>

                <div className="field">
                  <label>Routing Email Address</label>
                  <input 
                    type="email" 
                    title="Routing Email Address" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn-primary">Save Options</button>
                  {isSaved && <span className="success-text">✓ Settings updated!</span>}
                </div>
              </form>
            </section>

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