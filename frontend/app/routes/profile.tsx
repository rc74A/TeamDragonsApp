import {useState} from "react";
import { Link } from "react-router";
import "./app.css";
import "./profile.css";

const _API_BASE = import.meta.env.VITE_ATS_API_URL ?? "http://localhost:8000";
const _EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
};

const _EMPTY_PROFILE: ProfileForm = {
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
function _currentUserId(): string {
  if (typeof window === "undefined") {
    return "1";
  }
  return window.localStorage.getItem("userId") ?? "1";
}

export default function Profile() {
  const [profile, setProfile] = useState({ 
    name: "Test User", 
    email: "test@email.com", 
    phone: "", 
    location: "", 
    summary: "" 
  });

  const [errors, setErrors] = useState({ email: "", phone: "" });

  const totalFields = Object.keys(profile).length;
  const filledFields = Object.values(profile).filter(value => value.trim() !== "").length;
  const completionPercentage = Math.round((filledFields / totalFields) * 100);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;
    const newErrors = { email: "", phone: "" };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profile.email.trim() && !emailRegex.test(profile.email)) {
      newErrors.email = "Please enter a valid email routing address (e.g., name@domain.com).";
      valid = false;
    }

    const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
    if (profile.phone.trim() && !phoneRegex.test(profile.phone)) {
      newErrors.phone = "Please enter a valid 10-digit phone sequence.";
      valid = false;
    }

    setErrors(newErrors);

    if (valid) {
      alert("Profile data saved successfully!");
    }
  };

  return (
    <div className="profile-root">
      <header className="profile-header">Dragon Application</header>

      <div className="profile-workspace">
        <aside className="profile-sidebar">
          <ul className="profile-nav-list">
            <li><Link to="/" className="profile-nav-link">Dashboard</Link></li>
            <li><Link to="/profile" className="profile-nav-link active">Profile</Link></li>
            <li><Link to="/settings" className="profile-nav-link">Settings</Link></li>
          </ul>
        </aside>

        <main className="profile-main">
          <div className="profile-content-box">
            <h2>Candidate Profile</h2>
            <p className="settings-subtitle">Keep your structural summary records updated for matching pipeline discovery.</p>
            
            <div className="progress-container">
              <div className="progress-header-text">
                <span>Setup Completion Progress</span>
                <span>{completionPercentage}%</span>
              </div>
              <div className="progress-track">
                  <progress className="progress-fill-bar" max="100" value={completionPercentage} title="Profile Setup Completion Bar"/>
              </div>
            </div>

            <section className="settings-section">
              <h3>Personal Identifiers</h3>
              <form className="settings-form" onSubmit={handleSave}>
                <div className="field">
                  <label>Full Name</label>
                  <input type="text" title="Full Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                </div>
                
                <div className="field">
                  <label>Email Address</label>
                  <input type="email" title="Email Address" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                  {errors.email && <span className="error-text">{errors.email}</span>}
                </div>
                
                <div className="field">
                  <label>Phone Number</label>
                  <input type="text" title="Phone Number" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="(555) 000-0000" />
                  {errors.phone && <span className="error-text">{errors.phone}</span>}
                </div>

                <div className="field">
                  <label>Location</label>
                  <input type="text" title="Location" value={profile.location} onChange={(e) => setProfile({ ...profile, location: e.target.value })} placeholder="City, NJ" />
                </div>

                <div className="field">
                  <label>Professional Summary</label>
                  <input type="text" title="Professional Summary" value={profile.summary} onChange={(e) => setProfile({ ...profile, summary: e.target.value })} placeholder="Brief background..." />
                </div>

                <button type="submit" className="btn-primary">Save Profile Data</button>
              </form>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}