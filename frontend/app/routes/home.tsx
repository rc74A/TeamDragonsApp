import { Link } from "react-router";

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
            <li><a href="#dashboard">Dashboard</a></li>
            <li><a href="#profile">Profile</a></li>
            <li><a href="#settings">Settings</a></li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <h2>Welcome</h2>
        <p>
          This is your dashboard.
        </p>
      </main>
    </div>
  </div>
);
}


