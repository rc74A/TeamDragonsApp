import { useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";
import "./app.css";

// 1. The Loader runs on the server BEFORE the page loads to fetch data
export async function loader({ request }: Route.LoaderArgs) {
  try {
    // In a full production app, you would extract a secure session token or user ID here.
    // For Sprint 1 testing, we will fetch the active candidate profile from your backend.
    const response = await fetch("http://localhost:8000/api/current-user");
    
    if (!response.ok) {
      return { username: "Candidate" }; // Fallback name if not authenticated
    }

    const data = await response.json();
    return { username: data.username || "Candidate" };
  } catch (error) {
    console.error("Failed to load user profile data:", error);
    return { username: "Candidate" }; // Fallback name if network fails
  }
}

export default function Dashboard() {
  // 2. Access the data fetched by the loader above
  const { username } = useLoaderData() as { username: string };

  return (
    <div className="main-layout">
      
      <header className="app-banner">
        Dragon Application
      </header>

      <div className="content-wrapper">
        
        <aside className="dashboard-sidebar">
          <ul>
            <li>
              <a href="/dashboard" className="active">
                Dashboard
              </a>
            </li>
            <li>
              <a href="/profile">Profile</a>
            </li>
            <li>
              <a href="/settings">Settings</a>
            </li>
          </ul>
        </aside>

        <main className="main-workspace">
          <div className="workspace-skeleton">
            {/* 🟢 DYNAMIC GREETING: Displays the logged-in user's name! */}
            <h2>Welcome, {username}</h2>
            <p>This is your dashboard.</p>
            
            <div className="skeleton-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginTop: "24px" }}>
              <div style={{ padding: "20px", backgroundColor: "#2d3748", borderRadius: "12px", border: "1px solid #4a5568", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#e2e8f0" }}>Active Applications</h3>
                <p style={{ fontSize: "28px", fontWeight: "bold", color: "#06B6D4" }}>0</p>
              </div>
              
              <div style={{ padding: "20px", backgroundColor: "#2d3748", borderRadius: "12px", border: "1px solid #4a5568", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.2)" }}>
                <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#e2e8f0" }}>Available Matchings</h3>
                <p style={{ fontSize: "28px", fontWeight: "bold", color: "#06B6D4" }}>Explore Board</p>
              </div>
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}