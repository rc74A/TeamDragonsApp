import React, { useState } from "react";
import "./app.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const loginLink = `${import.meta.env.VITE_API_URL}/api/auth/login`;

  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch(loginLink, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uname: username, pwd: password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.detail || "Login failed");
        return;
      }
      window.location.href = "/";
    } catch (err) {
      setError("Network error, please try again");
    } finally {
      setPassword("");
    }
  };

  return (
    <div className="register-page">
      <div className="auth-card">
        
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Log in to your Dragon Application account</p>

        {/* Dynamic Error Banner displays only if error state fires */}
        {error && <div className="error-banner">{error}</div>}
        
        <form onSubmit={submitLogin}>
          
          <div className="form-group">
            <label className="input-label" htmlFor="username">Email Address</label>
            <input
              value={username}
              onChange={handleUsernameChange}
              type="text"
              id="username"
              name="username"
              required
              placeholder="you@example.com"
            />
          </div>
          
          <div className="form-group-last">
            <label className="input-label" htmlFor="password">Password</label>
            <input
              value={password}
              onChange={handlePasswordChange}
              type="password"
              id="password"
              name="password"
              required
              placeholder="••••••••"
            />
          </div>
          
          {/* Reuses your global button component definitions */}
          <button type="submit" style={{ width: "100%" }}>
            Log In
          </button>
        </form>
        
        <div className="auth-footer">
          Don't have an account? <a href="/register">Register here</a>
        </div>
        
      </div>
    </div>
  );
}
