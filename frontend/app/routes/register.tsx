import { data, redirect } from "react-router";
import type { Route } from "./+types/register";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  
  // Extract all relevant ATS fields
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirmPassword")?.toString();
  const firstName = formData.get("firstName")?.toString().trim();
  const lastName = formData.get("lastName")?.toString().trim();
  const dob = formData.get("dob")?.toString();
  const phone = formData.get("phone")?.toString().trim();

  // 1. Core Server-Side Validations
  if (!email || !password || !confirmPassword || !firstName || !lastName || !dob || !phone) {
    return data({ error: "All fields are required to create a profile." }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return data({ error: "Passwords do not match." }, { status: 400 });
  }

  try {
    const BACKEND_URL = "http://localhost:8000/api/register"; 

    // Forward the expanded object payload to Python
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        email, 
        password, 
        first_name: firstName, 
        last_name: lastName, 
        dob, 
        phone 
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return data({ error: result.detail || "Registration failed." }, { status: response.status });
    }

    return redirect("/login");
  } catch (err) {
    console.error("Failed to connect to Python backend:", err);
    return data({ error: "Unable to connect to registration server." }, { status: 500 });
  }
}

export default function Register({ actionData }: Route.ComponentProps) {
  const errorMessage = actionData?.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Create your ATS Profile
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            Set up your candidate account to start tracking jobs.
          </p>
        </div>

        {errorMessage && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-200">
            <p className="text-sm font-medium text-red-800">{errorMessage}</p>
          </div>
        )}

        <form className="space-y-4" method="POST">
          {/* Name Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
              <input name="firstName" type="text" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" placeholder="John" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
              <input name="lastName" type="text" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" placeholder="Doe" />
            </div>
          </div>

          {/* Contact Row */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
            <input name="email" type="email" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone Number</label>
            <input name="phone" type="tel" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" placeholder="(123) 456-7890" />
          </div>

          {/* DOB Row */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Date of Birth</label>
            <input name="dob" type="date" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" />
          </div>

          {/* Passwords */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
            <input name="password" type="password" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" placeholder="••••••••" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Confirm Password</label>
            <input name="confirmPassword" type="password" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-indigo-500" placeholder="••••••••" />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer shadow-sm"
            >
              Register Candidate Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}