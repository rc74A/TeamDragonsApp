import { useState } from "react";
import "./login.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const BACKEND_URL =
        import.meta.env.VITE_API_URL ?? "http://localhost:8000";
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uname: username, pwd: password }),
      });

      if (!response.ok) {
        setIsSubmitting(false);
        try {
          const data = await response.json();
          setError(data.detail || "Invalid username or password");
        } catch {
          setError("Invalid username or password");
        }
        return;
      }

      window.location.href = "/";
    } catch {
      setIsSubmitting(false);
      setError("Network error, please try again");
    }
  };

  return (
    <div className="login-viewport">
      <div className="login-card-expanded">
        <div className="login-header-group">
          <h1>Welcome Back</h1>
          <p>Log in to your Dragon Application account</p>
        </div>

        <form onSubmit={handleLoginSubmit}>
          {/* Email Address Block Row */}
          <div className="login-field-row">
            <div className="login-input-wrapper">
              <label htmlFor="username">Email Address</label>
              <input
                type="text"
                id="username"
                required
                placeholder="you@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {/* Password Block Row */}
          <div className="login-field-row">
            <div className="login-input-wrapper">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Core Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="login-submit-anchor"
          >
            {isSubmitting ? "Verifying Credentials..." : "Log In"}
          </button>

          {/* Error banner handler block */}
          {error && <p className="login-error-banner">⚠️ {error}</p>}
        </form>

        {/* Dynamic bottom registration navigation text */}
        <div className="login-footer-row">
          Do you not have an account? <a href="/register">Register here</a>
        </div>
      </div>
    </div>
  );
}
