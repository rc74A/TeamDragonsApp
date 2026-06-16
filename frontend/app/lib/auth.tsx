import { redirect } from "react-router";

export async function requireAuth(request: Request) {
  const clientCookie = request.headers.get("cookie") || "";
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
