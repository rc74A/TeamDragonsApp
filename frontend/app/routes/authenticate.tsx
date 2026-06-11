import {Navigate, Outlet} from "react-router-dom";
export default function Authentication() {
  const isAuthenticated = !!localStorage.getItem("token");

  if(!isAuthenticated) {
    return <Navigate to="/login" replace/>;
  }

  return <Outlet />;
}
