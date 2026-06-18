import { redirect } from "react-router";

export async function requireAuth(request: Request) {
  // Read the cookie from incoming server headers
  let clientCookie =
    request.headers.get("Cookie") || request.headers.get("cookie") || "";

  if (!clientCookie && typeof document !== "undefined") {
    clientCookie = document.cookie || "";
  }

  if (!clientCookie) {
    throw redirect("/login");
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
    headers: {
      "Content-Type": "application/json",
      Cookie: clientCookie,
    },
  });

  if (!response.ok) {
    throw redirect("/login");
  }

  return response.json();
}
