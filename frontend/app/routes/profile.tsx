import { requireAuth } from "../lib/auth";
import type { Route } from "./+types/profile";
import { Link, useNavigate } from "react-router";
import { useEffect, useState, type FormEvent } from "react";
import "./app.css";
import "./profile.css";

export async function loader({ request }: Route.LoaderArgs) {
  return await requireAuth(request);
}

const API_BASE = import.meta.env.VITE_ATS_API_URL ?? "http://localhost:8000";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Profile() {
  const navigate = useNavigate();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    summary: "",
  });

  const [errors, setErrors] = useState({ email: "", phone: "", server: "" });
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function verifyAndLoad() {
      try {
        // 1. Verify the cookie session with the backend first
        const authRes = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (!authRes.ok) {
          navigate("/login", { replace: true });
          return;
        }

        const res = await fetch(`${API_BASE}/api/profile`, {
          method: "GET",
          headers: { "X-User-Id": "1" },
        });

        if (res.ok) {
          const data = await res.json();
          setProfile({
            full_name: data.full_name || "",
            email: data.email || "",
            phone: data.phone || "",
            location: data.location || "",
            summary: data.summary || "",
          });
        }

        setIsLoadingAuth(false);
      } catch {
        navigate("/login", { replace: true });
      }
    }

    verifyAndLoad();
  }, [navigate]);

  const totalFields = Object.keys(profile).length;
  const filledFields = Object.values(profile).filter(
    (value) => value.trim() !== "",
  ).length;
  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    const newErrors = { email: "", phone: "", server: "" };

    if (profile.email.trim() && !EMAIL_PATTERN.test(profile.email)) {
      newErrors.email = "Enter a valid email address";
      valid = false;
    }

    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    if (profile.phone.trim() && !phoneRegex.test(profile.phone)) {
      newErrors.phone = "Please enter a valid 10-digit phone sequence.";
      valid = false;
    }

    setErrors(newErrors);

    if (valid) {
      try {
        const res = await fetch(`${API_BASE}/api/profile`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-User-Id": "1",
          },
          body: JSON.stringify(profile),
        });

        if (res.ok) {
          setSuccessMessage("Profile saved.");
          setTimeout(() => setSuccessMessage(""), 3000);
        } else {
          setErrors((prev) => ({
            ...prev,
            server: "Failed to save profile details.",
          }));
          setTimeout(
            () => setErrors((prev) => ({ ...prev, server: "" })),
            3000,
          );
        }
      } catch {
        setErrors((prev) => ({
          ...prev,
          server: "Network communication failure.",
        }));
        setTimeout(() => setErrors((prev) => ({ ...prev, server: "" })), 3000);
      }
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="profile-root flex justify-center items-center h-screen">
        <h2 className="text-cyan-400 font-sans font-bold text-xl">
          Verifying secure session...
        </h2>
      </div>
    );
  }

  return (
    <div className="profile-root">
      <div className="profile-workspace">
        <aside className="profile-sidebar">
          <h1 className="profile-header">
            Dragon Application
          </h1>
          
          <ul className="profile-nav-list">
            <li>
              <Link to="/" className="profile-nav-link">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/profile" className="profile-nav-link active">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="profile-nav-link">
                Settings
              </Link>
            </li>
          </ul>
        </aside>

        <main className="profile-main">
          {isLoadingAuth ? (
            /* Secure fallback state scoped strictly inside the viewport container */
            <div className="flex justify-center items-center h-64">
              <h2 className="text-cyan-400 font-sans font-bold text-xl">
                Verifying secure session...
              </h2>
            </div>
          ) : (
            <div className="profile-content-box">
              <h2>Profile</h2>
              <p className="settings-subtitle">
                Keep your structural summary records updated for matching pipeline
                discovery.
              </p>

              <div className="progress-container">
                <div className="progress-header-text">
                  <span>Setup Completion Progress</span>
                  <span>{completionPercentage}%</span>
                </div>
                <div className="progress-track">
                  <progress
                    className="progress-fill-bar"
                    max="100"
                    value={completionPercentage}
                    title="Profile Setup Completion Bar"
                  />
                </div>
              </div>

              <section className="settings-section">
                <h3>Personal Identifiers</h3>
                <form className="settings-form" onSubmit={handleSave}>
                  <div className="field">
                    <label htmlFor="full_name">Full name</label>
                    <input
                      id="full_name"
                      type="text"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                      placeholder="John Doe"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="text"
                      value={profile.email}
                      onChange={(e) =>
                        setProfile({ ...profile, email: e.target.value })
                      }
                      placeholder="john@example.com"
                    />
                    {errors.email && (
                      <span className="error-text">{errors.email}</span>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="phone">Phone</label>
                    <input
                      id="phone"
                      type="text"
                      value={profile.phone}
                      onChange={(e) =>
                        setProfile({ ...profile, phone: e.target.value })
                      }
                      placeholder="(555) 000-0000"
                    />
                    {errors.phone && (
                      <span className="error-text">{errors.phone}</span>
                    )}
                  </div>

                  <div className="field">
                    <label htmlFor="location">Location</label>
                    <input
                      id="location"
                      type="text"
                      value={profile.location}
                      onChange={(e) =>
                        setProfile({ ...profile, location: e.target.value })
                      }
                      placeholder="City, NJ"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="summary">Summary</label>
                    <input
                      id="summary"
                      type="text"
                      value={profile.summary}
                      onChange={(e) =>
                        setProfile({ ...profile, summary: e.target.value })
                      }
                      placeholder="Brief background..."
                    />
                  </div>

                  <div className="form-actions">
                    <button type="submit" className="btn-primary">
                      Save profile
                    </button>

                    {successMessage && (
                      <span className="success-text ml-2.5 text-green-600 font-medium">
                        {successMessage}
                      </span>
                    )}

                    {errors.server && (
                      <span className="error-text ml-2.5 text-red-500 font-bold">
                        {errors.server}
                      </span>
                    )}
                  </div>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}