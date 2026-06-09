import { type RouteConfig, route, index } from "@react-router/dev/routes";

export default [
	index("routes/dashboard.tsx"),
	route("login", "routes/login.tsx"),
] satisfies RouteConfig;
