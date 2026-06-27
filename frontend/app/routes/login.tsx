import { SignIn } from "@clerk/react-router";
import "./login.css";

export default function Login() {
  return (
  <div className="flex min-h-screen items-center justify-center">
    <SignIn />;
  </div>
  );
}
