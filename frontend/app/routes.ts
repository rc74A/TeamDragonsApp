import { type RouteConfig, route, index, layout } from "@react-router/dev/routes";

export default [
	route("login", "welcome/welcome.tsx"),

	layout("routes/authenticate.tsx", [
	index("routes/dashboard.tsx"),
	route("profile", "routes/profile.tsx"),
	]),
] satisfies RouteConfig;
