import type { Route } from "./+types/settings";
import { requireAuth } from "../lib/auth";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

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

export async function loader({ request }: Route.LoaderArgs) {
  return await requireAuth(request);
}

export default function Settings() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = loadAccountSettings();
    setDisplayName(stored.displayName);
    setEmail(stored.email);
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

  const inputStyle = {
    width: "100%",
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #4a5568",
    backgroundColor: "#1a202c",
    color: "#ffffff",
    boxSizing: "border-box" as const,
    marginTop: "6px"
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#1a202c", color: "#ffffff", fontFamily: "sans-serif" }}>
      
      {/* Top App Header */}
      <header style={{ backgroundColor: "#2d3748", padding: "16px 24px", fontSize: "20px", fontWeight: "bold", borderBottom: "1px solid #4a5568", color: "#06B6D4" }}>
        Dragon Application
      </header>

      {/* Main Split Layout Container */}
      <div style={{ display: "flex", flex: 1 }}>
        
        {/* Left Side Navigation Sidebar */}
        <aside style={{ width: "240px", backgroundColor: "#2d3748", borderRight: "1px solid #4a5568", padding: "24px 16px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            <li>
              <Link to="/" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", color: "#a0aec0", textDecoration: "none" }}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/profile" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", color: "#a0aec0", textDecoration: "none" }}>
                Profile
              </Link>
            </li>
            {/* 🟢 Keep it visible and highlighted since we are on this route copy */}
            <li>
              <Link to="/settings" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", backgroundColor: "#06B6D4", color: "#ffffff", textDecoration: "none", fontWeight: "bold" }}>
                Settings
              </Link>
            </li>
          </ul>
        </aside>

        {/* Right Side Core Content Area */}
        <main style={{ flex: 1, padding: "40px" }}>
          <div style={{ maxWidth: "600px" }}>
            
            <h2 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>Settings</h2>
            <p style={{ color: "#a0aec0", marginBottom: "32px" }}>Manage your account settings.</p>

            {/* Core Account Options Form Section */}
            <section style={{ backgroundColor: "#2d3748", padding: "24px", borderRadius: "12px", border: "1px solid #4a5568", marginBottom: "32px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "16px", color: "#06B6D4", marginTop: 0 }}>Account Details</h3>
              
              <form onSubmit={handleSave} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label htmlFor="displayName" style={{ fontSize: "14px", color: "#e2e8f0" }}>Display name</label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    style={inputStyle}
                  />
                  {errors.displayName && (
                    <p role="alert" style={{ color: "#f56565", fontSize: "14px", marginTop: "6px", margin: 0 }}>{errors.displayName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" style={{ fontSize: "14px", color: "#e2e8f0" }}>Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={inputStyle}
                  />
                  {errors.email && (
                    <p role="alert" style={{ color: "#f56565", fontSize: "14px", marginTop: "6px", margin: 0 }}>{errors.email}</p>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "4px" }}>
                  <button 
                    type="submit" 
                    style={{ padding: "10px 20px", borderRadius: "6px", border: "none", backgroundColor: "#06B6D4", color: "#ffffff", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Save Options
                  </button>
                  {saved && (
                    <span role="status" style={{ color: "#48bb78", fontSize: "14px", fontWeight: "bold" }}>✓ Settings saved.</span>
                  )}
                </div>
              </form>
            </section>

            {/* Coming Soon Features Section */}
            <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {COMING_SOON.map((item) => (
                <div 
                  key={item.title}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px", backgroundColor: "#2d3748", borderRadius: "12px", border: "1px solid #4a5568", opacity: 0.7 }}
                >
                  <div>
                    <h4 style={{ fontSize: "16px", fontWeight: "bold", margin: "0 0 4px 0", color: "#e2e8f0" }}>{item.title}</h4>
                    <p style={{ fontSize: "14px", color: "#a0aec0", margin: 0 }}>{item.description}</p>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: "bold", padding: "4px 8px", backgroundColor: "#4a5568", borderRadius: "4px", color: "#cbd5e0" }}>
                    Coming soon
                  </span>
                </div>
              ))}
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}