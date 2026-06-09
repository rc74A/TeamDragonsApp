import { data, redirect } from "react-router";
import type { Route } from "./+types/register";

// ==========================================
// BACKEND (Serverless Edge Action)
// ==========================================
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();

  // 1. Basic Client-Side Structure Validation
  if (!email || !password || !confirmPassword) {
    return data({ error: "All fields are required." }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return data({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    // 2. FORWARD THE REQUEST TO YOUR PYTHON BACKEND
    // Replace with your local python server URL (e.g., http://localhost:8000)
    const BACKEND_URL = "http://localhost:8000/api/register"; 

    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const result = await response.json();

    // 3. Handle Error Responses from Python
    if (!response.ok) {
      return data({ error: result.detail || "Registration failed." }, { status: response.status });
    }

    // 4. Success: Redirect cleanly to the login view
    return redirect("/login");

  } catch (err) {
    console.error("Failed to connect to Python backend:", err);
    return data({ error: "Unable to connect to registration server." }, { status: 500 });
  }
}

// ==========================================
// FRONTEND: React UI Component
// ==========================================
export default function Register({ actionData }: Route.ComponentProps) {
  const errorMessage = actionData?.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Create your account
          </h2>
        </div>

        {errorMessage && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" method="POST">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Password"
              />
            </div>
            <div>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                className="relative block w-full appearance-none rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Confirm Password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}