import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton, useAuth } from "@clerk/react-router";
import { useLoaderData, Link, useNavigate, redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import "./app.css";
import "./dashboard.css";

interface Job {
  id: number;
  title: string;
  company: string;
  stage: string;
}

interface JobMetrics {
  total: number;
  by_stage: Record<string, number>;
  applications: number;
  responses: number;
  offers: number;
  response_rate: number;
}

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const EMPTY_METRICS: JobMetrics = {
  total: 0,
  by_stage: {},
  applications: 0,
  responses: 0,
  offers: 0,
  response_rate: 0,
};

interface DashboardData {
  username: string;
  jobs: Job[];
  userId: string;
  metrics: JobMetrics;
}

export async function loader(args: Route.LoaderArgs): Promise<DashboardData> {
  const { userId, sessionClaims, getToken } = await getAuth(args);
  if (!userId) throw redirect("/login");

  const username = sessionClaims?.email ?? "User";

  try {
    const token = await getToken();

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const [jobsRes, metricsRes] = await Promise.all([
      fetch(`${BACKEND_URL}/api/jobs`, { headers }),
      fetch(`${BACKEND_URL}/api/jobs/metrics`, { headers }),
    ]);

    const jobsData = jobsRes.ok ? await jobsRes.json() : [];
    const metrics = metricsRes.ok ? await metricsRes.json() : EMPTY_METRICS;

    return {
      username,
      userId: String(userId),
      jobs: jobsData,
      metrics,
    };
  } catch (error) {
    console.error("Loader failed:", error);
    return {
      username,
      userId: String(userId),
      jobs: [],
      metrics: EMPTY_METRICS,
    };
  }
}

export default function Dashboard() {
  const { userId, jobs, username, metrics } = useLoaderData() as DashboardData;
  const navigate = useNavigate();

  const { getToken } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "",
    stage: "Wishlist",
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = editingJobId !== null;
    const url = isEditing
      ? `${BACKEND_URL}/api/jobs/${editingJobId}`
      : `${BACKEND_URL}/api/jobs`;

    try {
      const token = await getToken();

      if (!token) {
        console.error("Form submission blocked: Missing authentication token.");
        return;
      }

      await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobForm),
      });

      setIsModalOpen(false);
      navigate(".", { replace: true });
    } catch (error) {
      console.error("form submission failed", error);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm("Are you sure you want to delete this tracking entry?"))
      return;

    try {
      const token = await getToken();

      if (!token) {
        console.error("Could not retrieve a valid token");
        return;
      }

      const response = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        navigate(".", { replace: true });
      } else {
        console.error("Backend failed to delete the job:", response.status);
      }
    } catch (error) {
      console.error("Deletion request failed entirely:", error);
    }
  };

  return (
    <div className="db-root">
      <header className="db-header">Dragon Application</header>
      <div className="db-workspace">
        <aside className="sidebar">
          <ul>
            <li>
              <Link to="/" className="nav-link-active">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/findjobs" className="nav-link">
                Find Jobs
              </Link>
            </li>
            <li>
              <Link to="/profile" className="nav-link">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="nav-link">
                Settings
              </Link>
            </li>
            <li className="logout-item">
              <SignOutButton redirectUrl="/login">
                <button className="btn-logout">Sign Out</button>
              </SignOutButton>
            </li>
          </ul>
        </aside>

        <main className="db-main">
          <div className="db-container">
            <h2 className="view-title">Welcome, {username}!</h2>
            <p className="db-caption">
              Explore open listings matching your profile workspace.
            </p>

            <section className="db-metrics" aria-label="Dashboard metrics">
              <div className="db-metric">
                <span className="db-metric-value">{metrics.total}</span>
                <span className="db-metric-label">Total Jobs</span>
              </div>
              <div className="db-metric">
                <span className="db-metric-value">{metrics.applications}</span>
                <span className="db-metric-label">Applications</span>
              </div>
              <div className="db-metric">
                <span className="db-metric-value">{metrics.responses}</span>
                <span className="db-metric-label">Responses</span>
              </div>
              <div className="db-metric">
                <span className="db-metric-value">{metrics.offers}</span>
                <span className="db-metric-label">Offers</span>
              </div>
              <div className="db-metric">
                <span className="db-metric-value">
                  {Math.round(metrics.response_rate * 100)}%
                </span>
                <span className="db-metric-label">Response Rate</span>
              </div>
            </section>

            <div className="db-section-header">
              <h3>Job Applications</h3>
              <button
                type="button"
                onClick={() => {
                  setEditingJobId(null);
                  setJobForm({ title: "", company: "", stage: "Wishlist" });
                  setIsModalOpen(true);
                }}
                className="db-btn-add-job"
              >
                <span className="plus-icon">+</span>
                <span>Add Job</span>
              </button>
            </div>

            <div className="db-grid">
              {jobs.map((job) => (
                <div key={job.id} className="db-card">
                  <div>
                    <h4>{job.title}</h4>
                    <p className="db-card-company">🏢 {job.company}</p>
                    <p className="db-card-status">📋 Status: {job.stage}</p>
                  </div>
                  <div className="db-card-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingJobId(job.id);
                        setJobForm({
                          title: job.title,
                          company: job.company,
                          stage: job.stage,
                        });
                        setIsModalOpen(true);
                      }}
                      className="db-btn-edit"
                    >
                      Edit Tracking
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.id)}
                      className="db-btn-delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {isModalOpen && (
        <div className="db-modal-overlay">
          <div className="db-modal-content">
            <h3>
              {editingJobId
                ? "Edit Position Details"
                : "Post a New Tracking Entry"}
            </h3>
            <form onSubmit={handleFormSubmit}>
              <div className="db-form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  id="modalJobTitle"
                  required
                  placeholder="e.g. Software Engineer"
                  value={jobForm.title}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, title: e.target.value })
                  }
                />
              </div>
              <div className="db-form-group">
                <label>Company</label>
                <input
                  type="text"
                  id="modalCompany"
                  required
                  placeholder="e.g. Google"
                  value={jobForm.company}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, company: e.target.value })
                  }
                />
              </div>
              <div className="db-form-group">
                <label htmlFor="modalStage">Tracking Stage</label>
                <select
                  id="modalStage"
                  value={jobForm.stage}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, stage: e.target.value })
                  }
                >
                  <option value="Wishlist">Wishlist</option>
                  <option value="Applied">Applied</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="db-form-actions">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="db-btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" className="db-btn-submit">
                  {editingJobId ? "Save Changes" : "Track Job"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
