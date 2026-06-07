import { useEffect, useState, type FormEvent } from "react";

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
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = loadAccountSettings();
    setDisplayName(stored.displayName);
    setEmail(stored.email);
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

  const inputClass =
    "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 " +
    "focus:border-[#1E40AF] focus:outline-none focus:ring-2 focus:ring-[#06B6D4] " +
    "dark:border-gray-600 dark:bg-gray-900 dark:text-gray-50";
  const labelClass =
    "block text-sm font-medium text-gray-700 dark:text-gray-200";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 border-b border-gray-200 pb-4 dark:border-gray-700">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your account settings.
        </p>
      </header>

      <section
        aria-labelledby="account-heading"
        className="rounded-xl border border-gray-200 p-6 dark:border-gray-700"
      >
        <h2
          id="account-heading"
          className="text-lg font-medium text-gray-900 dark:text-gray-50"
        >
          Account
        </h2>
        <form className="mt-4 space-y-4" onSubmit={handleSave} noValidate>
          <div>
            <label htmlFor="displayName" className={labelClass}>
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className={inputClass}
            />
            {errors.displayName && (
              <p role="alert" className="mt-1 text-sm text-[#EF4444]">
                {errors.displayName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
            {errors.email && (
              <p role="alert" className="mt-1 text-sm text-[#EF4444]">
                {errors.email}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-[#1E40AF] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b3a9c] focus:outline-none focus:ring-2 focus:ring-[#06B6D4]"
            >
              Save
            </button>
            {saved && (
              <span role="status" className="text-sm text-[#10B981]">
                Saved.
              </span>
            )}
          </div>
        </form>
      </section>

      <section aria-labelledby="more-heading" className="mt-8">
        <h2 id="more-heading" className="sr-only">
          More settings
        </h2>
        <ul className="space-y-4">
          {COMING_SOON.map((item) => (
            <li
              key={item.title}
              aria-disabled="true"
              className="flex items-center justify-between rounded-xl border border-gray-200 p-6 opacity-60 dark:border-gray-700"
            >
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-50">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                Coming soon
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
