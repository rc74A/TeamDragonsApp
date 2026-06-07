import { Link } from "react-router";

export default function LoginView() {
  return (
    <>
      <nav>
        <Link to="/">Home</Link>
        {" | "}
        <Link to="/login">Login</Link>
      </nav>

      <h1>Login Page Test</h1>
    </>
  );
}
