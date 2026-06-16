import { useState } from "react";
import { useLoaderData, Link, useNavigate } from "react-router";
import type { Route } from "./+types/dashboard"; 
import { requireAuth } from "../lib/auth";       
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

export async function loader({ request }: Route.LoaderArgs): Promise<DashboardData> {
  const authUser = await requireAuth(request);
  const userId = authUser?.id || "1"; 

  try {
    const response = await fetch(`http://localhost:8000/api/jobs`, {
      headers: { "X-User-Id": String(userId) },
    });
    const jobsData = response.ok ? await response.json() : [];

    return {
      username: authUser?.username || "Joshua",
      jobs: jobsData.length > 0 ? jobsData : getFallbackJobs(),
    };
  } catch (error) {
    return {
      username: authUser?.username || "Joshua",
      jobs: getFallbackJobs(),
    };
  }
}

export default function Dashboard() {
  const { username, jobs } = useLoaderData() as DashboardData;
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobForm, setJobForm] = useState({ title: "", company: "", stage: "Wishlist" });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = editingJobId !== null;
    const url = isEditing ? `http://localhost:8000/api/jobs/${editingJobId}` : "http://localhost:8000/api/jobs";
    
    await fetch(url, {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "X-User-Id": "1" },
      body: JSON.stringify(jobForm),
    });
    setIsModalOpen(false);
    navigate(".", { replace: true }); 
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm("Are you sure you want to delete this tracking entry?")) return;
    await fetch(`http://localhost:8000/api/jobs/${jobId}`, {
      method: "DELETE",
      headers: { "X-User-Id": "1" },
    });
    navigate(".", { replace: true }); 
  };

  return (
    <div className="db-root">
      <header className="db-header">Dragon Application</header>
      <div className="db-workspace">
        <aside className="db-sidebar">
          <ul>
            <li><Link to="/" className="db-link-active">Dashboard</Link></li>
            <li><Link to="/profile" className="db-link">Profile</Link></li>
          </ul>
        </aside>

        <main className="db-main">
          <div className="db-container">
            <h2>Welcome!</h2>
            <p className="db-caption">Explore open listings matching your profile workspace.</p>
          <div className="db-section-header">
            <h3>Job Applications</h3>
              <button type="button" onClick={() => setIsModalOpen(true)} className="db-btn-add-job" >
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
                    <button type="button" onClick={() => {setEditingJobId(job.id); setJobForm({ title: job.title, company: job.company, stage: job.stage }); setIsModalOpen(true); }} 
                      className="db-btn-edit" >
                        Edit Tracking
                      </button>
                      <button type="button" disabled className="db-btn-delete db-btn-disabled">
                      Delete (Coming Soon)
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
            <h3>{editingJobId ? "Edit Position Details" : "Post a New Tracking Entry"}</h3>
            <form onSubmit={handleFormSubmit}>
              <div className="db-form-group">
                <label>Job Title</label>
                <input type="text" id="modalJobTitle" required placeholder="e.g. Software Engineer" value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} />
              </div>
              <div className="db-form-group">
                <label>Company</label>
                <input type="text" id="modalCompany" required placeholder="e.g. Google" value={jobForm.company} onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })} />
              </div>
              <div className="db-form-group">
                <label htmlFor="modalStage">Tracking Stage</label>
                <select id="modalStage" value={jobForm.stage} onChange={(e) => setJobForm({ ...jobForm, stage: e.target.value })}>
                  <option value="Wishlist">Wishlist</option>
                  <option value="Applied">Applied</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="db-form-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="db-btn-cancel">Cancel</button>
                <button type="submit" className="db-btn-submit">{editingJobId ? "Save Changes" : "Track Job"}</button>
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
    { id: 1, title: "Software Engineer Intern", company: "Google", stage: "Interviewing" },
    { id: 2, title: "Frontend Developer Co-op", company: "Vercel", stage: "Applied" },
  ];
}