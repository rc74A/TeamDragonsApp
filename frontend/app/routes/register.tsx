import { redirect, useActionData } from "react-router";
import type { Route } from "./+types/register";
import "./app.css";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  try {
    const response = await fetch(API_URL + "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uname: email, email: email, pwd: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.detail || "Registration failed." };
    }

    return redirect("/login");
  } catch (error) {
    console.error("Network communication failed:", error);
    return { error: "Could not connect to authentication server." };
  }
}

export default function Register() {
  const actionData = useActionData() as { error?: string } | undefined;
  return (
    <div className="register-page">
      <div className="auth-card">
        <h2 className="auth-title">Create Your Account</h2>
        <p className="auth-subtitle">
          Get started instantly with just your email.
        </p>
        {actionData?.error && (
          <div className="error-banner">{actionData.error}</div>
        )}
        <form method="post">
          <div className="form-group">
            <label className="input-label">Email Address</label>
            <input
              name="email"
              type="email"
              required
              placeholder="name@njit.edu"
            />
          </div>
          <div className="form-group">
            <label className="input-label">Password</label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
            />
          </div>
          <div className="form-group-last">
            <label className="input-label">Confirm Password</label>
            <input
              name="confirmPassword"
              type="password"
              required
              placeholder="••••••••"
            />
          </div>
          <button type="submit" style={{ width: "100%" }}>
            Sign Up Free
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <a href="/login">Log In</a>
        </p>
      </div>
    </div>
  );
}
