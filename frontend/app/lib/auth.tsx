import { redirect } from "react-router";

export async function requireAuth(request: Request) {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
    headers: { cookie: request.headers.get("cookie") || "" },
  });
  if (!response.ok) {
    throw redirect("/login");
  }
  return response.json();
}