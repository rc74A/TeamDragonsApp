import { useState } from "react";
import { useLoaderData, Link, useNavigate } from "react-router";
import type { Route } from "./+types/dashboard";

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
      fetch("http://localhost:8000/api/jobs", { headers: { "X-User-Id": "1" } })
    ]);
    const usernameData = userRes.ok ? await userRes.json() : { username: "Joshua" };
    const jobsData = jobsRes.ok ? await jobsRes.json() : [];

    const fallbackJobs = [
      { id: 1, title: "Software Engineer Intern", company: "Google", stage: "Interviewing" },
      { id: 2, title: "Frontend Developer Co-op", company: "Vercel", stage: "Applied" }
    ];
    return { username: usernameData.username, jobs: jobsData.length > 0 ? jobsData : fallbackJobs };
  } catch (error) {
    console.error("Error connecting to backend API:", error);
    return {
      username: "Joshua",
      jobs: [
        { id: 1, title: "Software Engineer Intern", company: "Google", stage: "Interviewing" },
        { id: 2, title: "Frontend Developer Co-op", company: "Vercel", stage: "Applied" }
      ]
    };
  }
}

export default function Dashboard() {
  const { username, jobs } = useLoaderData() as DashboardData;
  const navigate = useNavigate();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null); // 🟢 Tracks if we are editing
  const [jobForm, setJobForm] = useState({ title: "", company: "", stage: "Wishlist" });
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
    const url = isEditing ? `http://localhost:8000/api/jobs/${editingJobId}` : "http://localhost:8000/api/jobs";
    const method = isEditing ? "PUT" : "POST"; 

    try {
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json", "X-User-Id": "1" },
        body: JSON.stringify(jobForm)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to process job execution.");
      }

      setIsModalOpen(false);
      setEditingJobId(null);
      setJobForm({ title: "", company: "", stage: "Wishlist" });
      navigate(".", { replace: true }); 
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "#1a202c", color: "#ffffff", fontFamily: "sans-serif" }}>
      <header style={{ backgroundColor: "#2d3748", padding: "16px 24px", fontSize: "20px", fontWeight: "bold", borderBottom: "1px solid #4a5568", color: "#06B6D4" }}>
        Dragon Application
      </header>

      <div style={{ display: "flex", flex: 1 }}>
        <aside style={{ width: "240px", backgroundColor: "#2d3748", borderRight: "1px solid #4a5568", padding: "24px 16px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
            <li>
              <Link to="/" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", backgroundColor: "#06B6D4", color: "#ffffff", textDecoration: "none", fontWeight: "bold" }}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/profile" style={{ display: "block", padding: "10px 16px", borderRadius: "8px", color: "#a0aec0", textDecoration: "none" }}>
                Profile
              </Link>
            </li>
          </ul>
        </aside>

        <main style={{ flex: 1, padding: "40px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
            <h2>Welcome, {username}</h2>
            <p style={{ color: "#a0aec0", marginBottom: "32px" }}>Explore open listings matching your profile workspace.</p>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "2px solid #2d3748", paddingBottom: "8px" }}>
              <h3 style={{ fontSize: "20px", fontWeight: "bold", margin: 0 }}>Available Opportunities</h3>
              <button type="button" onClick={openCreateModal} style={{ backgroundColor: "#06B6D4", color: "#ffffff", border: "none", width: "36px", height: "36px", borderRadius: "50%", fontSize: "22px", fontWeight: "bold", cursor: "pointer" }}>
                +
              </button>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
              {jobs.map((job) => (
                <div key={job.id} style={{ padding: "24px", backgroundColor: "#2d3748", borderRadius: "12px", border: "1px solid #4a5568", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <h4 style={{ fontSize: "18px", fontWeight: "bold", color: "#06B6D4", marginBottom: "8px", marginTop: 0 }}>{job.title}</h4>
                    <p style={{ fontSize: "14px", color: "#e2e8f0", marginBottom: "4px" }}>🏢 {job.company}</p>
                    <p style={{ fontSize: "12px", display: "inline-block", padding: "4px 8px", backgroundColor: "#1a202c", borderRadius: "4px", color: "#e2e8f0" }}>
                      📋 Status: {job.stage}
                    </p>
                  </div>
                  {}
                  <button 
                    type="button" 
                    onClick={() => openEditModal(job)}
                    style={{ backgroundColor: "#4a5568", color: "#ffffff", border: "none", padding: "8px 12px", borderRadius: "6px", cursor: "pointer", marginTop: "16px", width: "fit-content", fontSize: "13px" }}
                  >
                    ✏️ Edit Tracking
                  </button>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#2d3748", padding: "32px", borderRadius: "12px", width: "100%", maxWidth: "450px", border: "1px solid #4a5568" }}>
            <h3 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "16px", color: "#06B6D4", marginTop: 0 }}>
              {editingJobId ? "Edit Position Details" : "Post a New Tracking Entry"}
            </h3>
            {formError && <p style={{ color: "#f56565", fontSize: "14px", marginBottom: "12px" }}>{formError}</p>}
            
            <form onSubmit={handleFormSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", color: "#e2e8f0", marginBottom: "6px" }}>Job Title</label>
                <input type="text" required value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #4a5568", backgroundColor: "#1a202c", color: "#ffffff", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "14px", color: "#e2e8f0", marginBottom: "6px" }}>Company</label>
                <input type="text" required value={jobForm.company} onChange={(e) => setJobForm({ ...jobForm, company: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #4a5568", backgroundColor: "#1a202c", color: "#ffffff", boxSizing: "border-box" }} />
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "14px", color: "#e2e8f0", marginBottom: "6px" }}>Tracking Stage</label>
                <select value={jobForm.stage} onChange={(e) => setJobForm({ ...jobForm, stage: e.target.value })} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #4a5568", backgroundColor: "#1a202c", color: "#ffffff", boxSizing: "border-box" }}>
                  <option value="Wishlist">Wishlist</option>
                  <option value="Applied">Applied</option>
                  <option value="Interviewing">Interviewing</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: "10px 16px", borderRadius: "6px", border: "1px solid #4a5568", backgroundColor: "transparent", color: "#a0aec0", cursor: "pointer" }}>Cancel</button>
                <button type="submit" style={{ padding: "10px 20px", borderRadius: "6px", border: "none", backgroundColor: "#06B6D4", color: "#ffffff", fontWeight: "bold", cursor: "pointer" }}>
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