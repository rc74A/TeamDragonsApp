import type { Route } from "./+types/profile";
import { requireAuth } from "../lib/auth";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

export async function loader({ request }: Route.LoaderArgs) {
  return await requireAuth(request);
}

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
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const calculateCompletion = (): number => {
    const fields: (keyof ProfileForm)[] = ["full_name", "email", "phone", "location", "summary"];
    const filledFields = fields.filter(field => form[field] && form[field].trim() !== "");
    return Math.round((filledFields.length / fields.length) * 100);
  };

  const completionPercentage = calculateCompletion();

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
      <header style={{ backgroundColor: "#2d3748", padding: "16px 24px", fontSize: "20px", fontWeight: "bold", borderBottom: "1px solid #4a5568", color: "#06B6D4" }}>
        Dragon Application
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <aside style={{ width: "240px", backgroundColor: "#2d3748", borderRight: "1px solid #4a5568", padding: "24px 16px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            <li>
              <Link to="/" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", color: "#a0aec0", textDecoration: "none" }}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/profile" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", backgroundColor: "#06B6D4", color: "#ffffff", textDecoration: "none", fontWeight: "bold" }}>
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", color: "#a0aec0", textDecoration: "none" }}>
                Settings
              </Link>
            </li>
          </ul>
        </aside>

        <main style={{ flex: 1, padding: "40px" }}>
          <div style={{ maxWidth: "600px" }}>
            <h2 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>Profile</h2>
            <p style={{ color: "#a0aec0", marginBottom: "24px" }}>Your identity, contact details, and summary.</p>
            <div style={{ backgroundColor: "#2d3748", padding: "16px 20px", borderRadius: "10px", border: "1px solid #4a5568", marginBottom: "32px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>
                <span style={{ color: "#e2e8f0" }}>Profile Setup Progress</span>
                <span style={{ color: "#06B6D4" }}>{completionPercentage}% Complete</span>
              </div>
              <div style={{ width: "100%", height: "10px", backgroundColor: "#1a202c", borderRadius: "5px", overflow: "hidden" }}>
                <div style={{ width: `${completionPercentage}%`, height: "100%", backgroundColor: "#06B6D4", transition: "width 0.4s ease-in-out" }} />
              </div>
            </div>

            <form onSubmit={handleSave} noValidate style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label htmlFor="full_name" style={{ fontSize: "14px", color: "#e2e8f0" }}>Full name</label>
                <input id="full_name" name="full_name" type="text" value={form.full_name} onChange={(event) => updateField("full_name", event.target.value)} style={inputStyle} />
              </div>

              <div>
                <label htmlFor="email" style={{ fontSize: "14px", color: "#e2e8f0" }}>Email</label>
                <input id="email" name="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} style={inputStyle} />
                {emailError && <p role="alert" style={{ color: "#f56565", fontSize: "14px", marginTop: "6px", margin: 0 }}>{emailError}</p>}
              </div>

              <div>
                <label htmlFor="phone" style={{ fontSize: "14px", color: "#e2e8f0" }}>Phone</label>
                <input id="phone" name="phone" type="tel" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} style={inputStyle} />
              </div>

              <div>
                <label htmlFor="location" style={{ fontSize: "14px", color: "#e2e8f0" }}>Location</label>
                <input id="location" name="location" type="text" value={form.location} onChange={(event) => updateField("location", event.target.value)} style={inputStyle} />
              </div>

              <div>
                <label htmlFor="summary" style={{ fontSize: "14px", color: "#e2e8f0" }}>Summary</label>
                <textarea id="summary" name="summary" rows={4} value={form.summary} onChange={(event) => updateField("summary", event.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "8px" }}>
                <button type="submit" style={{ padding: "10px 20px", borderRadius: "6px", border: "none", backgroundColor: "#06B6D4", color: "#ffffff", fontWeight: "bold", cursor: "pointer" }}>
                  Save profile
                </button>
                {status === "saved" && <span role="status" style={{ color: "#48bb78", fontSize: "14px", fontWeight: "bold" }}>✓ Profile saved successfully.</span>}
                {status === "error" && <span role="alert" style={{ color: "#f56565", fontSize: "14px", fontWeight: "bold" }}>⚠ Could not save. Try again.</span>}
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}