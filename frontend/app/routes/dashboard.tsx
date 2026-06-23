import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton } from "@clerk/react-router";
import { useLoaderData, Link, useNavigate, redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import "./dashboard.css";

interface Job {
  id: number;
  title: string;
  company: string;
  stage: string;
}

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface DashboardData {
  username: string;
  jobs: Job[];
  userId: string;
}

export async function loader(args: Route.LoaderArgs): Promise<DashboardData> {
  const { userId, sessionClaims } = await getAuth(args);
  if (!userId) throw redirect("/login");

  const username = sessionClaims?.email ?? "Joshua"; // 👈 replaces authUser

  const authUser = { id: userID };

  try {
    const response = await fetch(`${BACKEND_URL}/api/jobs`, {
      headers: { "x-user-id": String(userId) },
    });
    const jobsData = response.ok ? await response.json() : [];

    return {
      username,
      userId: String(userId),
      jobs: jobsData.length > 0 ? jobsData : getFallbackJobs(),
    };
  } catch {
    return {
      username,
      userId: String(userId),
      jobs: getFallbackJobs(),
    };
  }
}

export default function Dashboard() {
  const { userId, jobs, username } = useLoaderData() as DashboardData;
  const navigate = useNavigate();

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

    await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify(jobForm),
    });
    setIsModalOpen(false);
    navigate(".", { replace: true });
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm("Are you sure you want to delete this tracking entry?"))
      return;
    await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
      method: "DELETE",
      headers: { "x-user-id": userId },
    });
    navigate(".", { replace: true });
  };

  return (
    <div className="db-root">
      <header className="db-header">Dragon Application</header>
      <div className="db-workspace">
        <aside className="db-sidebar">
          <ul>
            <li>
              <Link to="/" className="db-link-active">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/findjobs" className="db-link">
                Find Jobs
              </Link>
            </li>
            <li>
              <Link to="/profile" className="db-link">
                Profile
              </Link>
            </li>
            <li className="db-logout-item">
              <SignOutButton redirectUrl="/login">
                <button className="bg-red-500 text-white px-4 py-2 rounded">
                  Sign Out
                </button>
              </SignOutButton>
            </li>
          </ul>
        </aside>

        <main className="db-main">
          <div className="db-container">
            <h2>Welcome, {username}!</h2>
            <p className="db-caption">
              Explore open listings matching your profile workspace.
            </p>
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

function getFallbackJobs(): Job[] {
  return [
    {
      id: 1,
      title: "Software Engineer Intern",
      company: "Google",
      stage: "Interviewing",
    },
    {
      id: 2,
      title: "Frontend Developer Co-op",
      company: "Vercel",
      stage: "Applied",
    },
  ];
}
