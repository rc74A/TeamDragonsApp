import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton } from "@clerk/react-router";
import { Link, useNavigate, redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import "./dashboard.css";

interface FoundJob { 
  id: number,
  title: string;
  employer: string;
  description: string;
  apply_link: string;
  salary: number;
  employment_type: string;
  country: string;
  state: string;
  city: string;
}

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function loader(args: Route.LoaderArgs) {
  const { userId, sessionClaims } = await getAuth(args);
  if (!userId) throw redirect("/login");
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [searchForm, setSearchForm] = useState({
    title: "",
    employer: "",
    keywords: "",
    excluded_works: "",
  });
  const [jobs, setJobs] = useState<FoundJob[]>([]);

  const handleSearchSubmit = async () => {
    const response = await fetch(`${BACKEND_URL}/api/findjobs/find_job`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(searchForm),
    });

    if (!response.ok) {
      setError("Could not find any jobs with the desired requirements.");
      return;
    }
  };

// TODO: Change the class names to match custom page styling
  return (
    <div className="search-root">
      <header className="search-header">Dragon Application</header>
      <div className="search-workspace">
        <aside className="search-sidebar">
          <ul>
            <li>
              <Link to="/" className="search-link-active">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/profile" className="search-link">
                Profile
              </Link>
            </li>
            <li className="search-logout-item">
              <SignOutButton redirectUrl="/login">
                <button className="bg-red-500 text-white px-4 py-2 rounded">
                  Sign Out
                </button>
              </SignOutButton>
            </li>
          </ul>
        </aside>

        <main className="search-main">
          <div className="search-container">
            <h2>Welcome!</h2>
            <p className="search-caption">
              Search for new and exciting opportunities!
            </p>
            <div className="search-section-header">
              <h3>Job Search</h3>
              <button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="search-btn-add-job"
              >
                <span className="plus-icon">+</span>
                <span>Search Job</span>
              </button>
            </div>

            <div className="search-grid">
              {jobs.map((job: FoundJob) => (
                <div key={job.id} className="search-card">
                  <div>
                    <h4>{job.title}</h4>
                    <p className="search-card-company">🏢 {job.employer}</p>
                    <p className="search-card-company">🏢 {job.description}</p>
                    <p className="search-card-company">🏢 {job.employment_type}</p>
                    <p className="search-card-company">🏢 {job.country}, {job.state}, {job.city}</p>
                    <p className="search-card-status">📋 salary: {job.salary}</p>
                    <p className="search-card-company">🏢 {job.apply_link}</p>
                  </div>
                  <div className="search-card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        // TODO: Open link and add to applied jobs
                      }}
                      className="search-btn-add"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // TODO: Remove from cards, and put in a denied jobs list
                      }}
                      className="search-btn-delete search-btn-disabled"
                    >
                      Not Interested
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
