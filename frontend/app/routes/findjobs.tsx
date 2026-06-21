import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton } from "@clerk/react-router";
import { Link, useNavigate, redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import "./findjobs.css";

interface FoundJob {
  id: number;
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

export default function FindJobs() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [searchForm, setSearchForm] = useState({
    title: "",
    employer: "",
    keywords: "",
    excluded_words: "",
  });
  const [jobs, setJobs] = useState<FoundJob[]>([]);

  const handleSearchSubmit = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/findjobs/find_job`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: searchForm.title,
          employer: searchForm.employer,
          keywords: searchForm.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          excluded_words: searchForm.excluded_words
            .split(",")
            .map((w) => w.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        setError("Could not find any jobs with the desired requirements.");
        return;
      }

      const data: FoundJob[] = await response.json();

      if (data.length == 0) {
        setError("Could not find any jobs with the desired requirements.");
        return;
      }

      setJobs(data ?? []);
      setError("");
    } catch {
      setError("Network error while searching for jobs.");
    }
  };

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
            <li>
              <Link to="/profile" className="search-link">
                Settings
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

            <section className="search-section">
              <h3>Search Criteria</h3>
              <div className="search-form">
                <div className="field">
                  <label htmlFor="title">Job title</label>
                  <input
                    id="title"
                    type="text"
                    value={searchForm.title}
                    onChange={(e) =>
                      setSearchForm({ ...searchForm, title: e.target.value })
                    }
                    placeholder="Software Engineer"
                  />
                </div>

                <div className="field">
                  <label htmlFor="employer">Employer</label>
                  <input
                    id="employer"
                    type="text"
                    value={searchForm.employer}
                    onChange={(e) =>
                      setSearchForm({ ...searchForm, employer: e.target.value })
                    }
                    placeholder="Acme Corp"
                  />
                </div>

                <div className="field">
                  <label htmlFor="keywords">Keywords</label>
                  <input
                    id="keywords"
                    type="text"
                    value={searchForm.keywords}
                    onChange={(e) =>
                      setSearchForm({ ...searchForm, keywords: e.target.value })
                    }
                    placeholder="remote, react"
                  />
                </div>

                <div className="field">
                  <label htmlFor="excluded_words">Excluded words</label>
                  <input
                    id="excluded_words"
                    type="text"
                    value={searchForm.excluded_words}
                    onChange={(e) =>
                      setSearchForm({
                        ...searchForm,
                        excluded_words: e.target.value,
                      })
                    }
                    placeholder="senior, manager"
                  />
                </div>
              </div>
            </section>

            {error && (
              <section className="search-error-section">
                <p className="error-text">{error}</p>
              </section>
            )}

            <div className="search-section-header">
              <h3>Job Search</h3>
              <button
                type="button"
                onClick={() => handleSearchSubmit()}
                className="search-btn-add-job"
              >
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
                    <p className="search-card-company">
                      🏢 {job.employment_type}
                    </p>
                    <p className="search-card-company">
                      🏢 {job.country}, {job.state}, {job.city}
                    </p>
                    <p className="search-card-status">
                      📋 salary: {job.salary}
                    </p>
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
