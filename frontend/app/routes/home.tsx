import { Link } from "react-router";

function Home() {
  return <h1> Home Page Test </h1>;
}

function Login() {
  return <h1> Login Page Test </h1>;
}

export default function App() {
  return (
    <nav>
      <Link to="/">Home</Link> | <Link to="/login">Login</Link>
    </nav>
  );
}
