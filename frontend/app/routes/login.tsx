import {
  Form,
  redirectDocument,
  useActionData,
  useNavigation,
} from "react-router";
import "./app.css";

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const username = formData.get("username");
  const password = formData.get("password");

  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uname: username, pwd: password }),
    });

    if (!response.ok) {
      try {
        const data = await response.json();
        return { error: data.detail || "Invalid username or password" };
      } catch {
        return { error: "Invalid username or password" };
      }
    }

    const setCookie = response.headers.get("set-cookie");
    const headers = new Headers();
    if (setCookie) {
      headers.append("Set-Cookie", setCookie);
    }

    return redirectDocument("/", { headers });
  } catch (err) {
    return { error: "Network error, please try again" };
  }
}

export default function Login() {
  const actionData = useActionData() as { error?: string } | undefined;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="register-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">
          Log in to your Dragon Application account
        </p>

        <div className="content-layout">
          <aside className="sidebar">
            <nav>
              <ul className="menu-list">
                <li>
                  <a href="/register">Register</a>
                </li>
              </ul>
            </nav>
          </aside>
        </div>

        <main className="flex justify-center items-center">
          <div className="bg-[#06B6D4] rounded-md h-xl w-xl shadow-md p-8">
            <Form method="post" className="font-bold text-2xl">
              <div className="form-group">
                <label htmlFor="username">Email:</label>
                <br />
                <input
                  className="bg-white text-black"
                  type="text"
                  id="username"
                  name="username"
                  required
                  placeholder="you@example.com"
                />
              </div>

              <div className="form-group-last login-password-spacing">
                <label className="input-label" htmlFor="password">
                  Password
                </label>
                <input
                  className="bg-white text-black"
                  type="password"
                  id="password"
                  name="password"
                  required
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 login-submit-btn"
              >
                {isSubmitting ? "Logging In..." : "Log In"}
              </button>

              {actionData?.error && (
                <p className="text-red-500 mt-4 text-xl font-bold bg-white p-2 rounded border border-red-500 text-center">
                  {actionData.error}
                </p>
              )}
            </Form>

            <div className="auth-footer login-footer-styling">
              Do not have an account? <a href="/register">Register here</a>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
