import type { Route } from "./+types/dashboard";
import { requireAuth } from "../lib/auth";
import "./app.css";

export async function loader({ request }: Route.LoaderArgs) {
  return await requireAuth(request);
}

export default function App() {
  return (
    <div className="page-container">
      <header className="banner">
        <h1>Dragon Application</h1>
      </header>

<<<<<<< HEAD
    <div className="content-layout">
      <aside className="sidebar">
        <nav>
          <ul className="menu-list">
            <li><a href="/">Dashboard</a></li>
            <li><a href="/profile">Profile</a></li>
            <li><a href="/settings">Settings</a></li>
          </ul>
        </nav>
      </aside>
=======
      <div className="content-layout">
        <aside className="sidebar">
          <nav>
            <ul className="menu-list">
              <li>
                <a href="/">Dashboard</a>
              </li>
              <li>
                <a href="/profile">Profile</a>
              </li>
              <li>
                <a href="/settings">Settings</a>
              </li>
              <li>
                <a href="/login">Login</a>
              </li>
              <li>
                <a href="/register">Register</a>
              </li>
              {/* 
		For now a hyperlink, later will block access
	        with a login screen until user logs in 	
	    */}
              <li>
                <a href="/login">Dashboard</a>
              </li>
            </ul>
          </nav>
        </aside>
>>>>>>> 6dea16bc50c8778c83561232b74959f1d1da2c9d

        <main className="main-content">
          <h2>Welcome</h2>
          <p>This is your dashboard.</p>
        </main>
      </div>
    </div>
  );
}
