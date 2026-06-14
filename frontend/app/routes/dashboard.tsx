import { Link } from "react-router";
import "./app.css";

export default function App() {
  return (
    <div className="page-container">
      <header className="banner">
        <h1>Dragon Application</h1>
      </header>

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

        <main className="main-content">
          <h2>Welcome</h2>
          <p>This is your dashboard.</p>
        </main>
      </div>
    </div>
  );
}
