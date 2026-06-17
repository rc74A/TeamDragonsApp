import { requireAuth } from "../lib/auth";
import type { Route } from "./+types/settings";
import { Link, useNavigate } from "react-router";
import { useEffect, useState, type FormEvent } from "react";
import "./app.css";
import "./settings.css";

export async function loader({ request }: Route.LoaderArgs) {
  return await requireAuth(request);
}

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

export default function Settings() {
  const navigate = useNavigate();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load persisted values after hydration to prevent server/client mismatch
    const stored = loadAccountSettings();
    /* eslint-disable react-hooks/set-state-in-effect */
    setDisplayName(stored.displayName);
    setEmail(stored.email);
    /* eslint-enable react-hooks/set-state-in-effect */
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

  useEffect(() => {
    async function verifySession() {
      const BACKEND_URL =
        import.meta.env.VITE_ATS_API_URL ?? "http://localhost:8000";
      try {
        const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include", // Safely passes auth cookies across local port domains
        });

        if (!response.ok) {
          navigate("/login", { replace: true });
        } else {
          setIsLoadingAuth(false); // Valid user session -> render UI
        }
      } catch {
        navigate("/login", { replace: true });
      }
    }

    verifySession();
  }, [navigate]);

  if (isLoadingAuth) {
    return (
      <div
        className="settings-root-layout"
        style={{
          display: "flex