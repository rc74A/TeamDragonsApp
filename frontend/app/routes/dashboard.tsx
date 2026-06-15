import { useState } from "react";
import { useLoaderData, Link, useNavigate } from "react-router";
import "./dashboard.css";

interface Job {
  id: number;
  title: string;
  company: string;
  stage: string;
}

interface DashboardData {
  username: string;
  jobs: Job[];
}

export async function loader(): Promise<DashboardData> {
  try {
    const [userRes, jobsRes] = await Promise.all([
      fetch("http://localhost:8000/api/current-user"),
      fetch("http://localhost:8000/api/jobs", {
        headers: { "X-User-Id": "1" },
      }),
    ]);
    const usernameData = userRes.ok
      ? await userRes.json()
      : { username: "Joshua" };
    const jobsData = jobsRes.ok ? await jobsRes.json() : [];

    const fallbackJobs = [
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
    return {
      username: usernameData.username,
      jobs: jobsData.length > 0 ? jobsData : fallbackJobs,
    };
  } catch (error) {
    console.error("Error connecting to backend API:", error);
    return {
      username: "Joshua",
      jobs: [
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
      ],
    };
  }
}

export default function Dashboard() {
  const { username, jobs } = useLoaderData() as DashboardData;
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "",
    stage: "Wishlist",
  });
  const [formError, setFormError] = useState("");

  const openCreateModal = () => {
    setEditingJobId(null);
    setJobForm({ title: "", company: "", stage: "Wishlist" });
    setIsModalOpen(true);
  };

  const openEditModal = (job: Job) => {
    setEditingJobId(job.id);
    setJobForm({ title: job.title, company: job.company, stage: job.stage });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const isEditing = editingJobId !== null;
    const url = isEditing
      ? `http://localhost:8000/api/jobs/${editingJobId}`
      : "http://localhost:8000/api/jobs";
    const method = isEditing ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", "X-User-Id": "1" },
        body: JSON.stringify(jobForm),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to process job execution.");
      }

      setIsModalOpen(false);
      setEditingJobId(null);
      setJobForm({ title: "", company: "", stage: "Wishlist" });
      navigate(".", { replace: true });
    } catch (err: unknown) {
      setFormError((err as Error).message || "An unexpected error occurred.");
    }
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
              <Link to="/profile" className="db-link">
                Profile
              </Link>
            </li>
          </ul>
        </aside>

        <main className="db-main">
          <div className="db-container">
            <h2>Welcome, {username}</h2>
            <p className="db-caption">
              Explore open listings matching your profile workspace.
            </p>

            <div className="db-section-header">
              <h3>Available Opportunities</h3>
              <button
                type="button"
                onClick={openCreateModal}
                className="db-btn-circle"
              >
                +
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
                  <button
                    type="button"
                    onClick={() => openEditModal(job)}
                    className="db-btn-edit"
                  >
                    Edit Tracking
                  </button>
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
            {formError && <p className="db-error">{formError}</p>}

            <form onSubmit={handleFormSubmit}>
              <div className="db-form-group">
                <label>Job Title</label>
                <input
                  type="text"
                  title="Job Title Input"
                  required
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
                  title="Company Name Input"
                  required
                  value={jobForm.company}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, company: e.target.value })
                  }
                />
              </div>
              <div className="db-form-group">
                <label>Tracking Stage</label>
                <select
                  title="Tracking Stage Dropdown"
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
