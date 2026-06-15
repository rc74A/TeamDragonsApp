import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
  index("routes/dashboard.tsx"),
  route("profile", "routes/profile.tsx"),
  route("settings", "routes/settings.tsx"),
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
] satisfies RouteConfig;
