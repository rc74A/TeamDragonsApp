import React, { useState, useMemo } from "react";
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
  location: string | null;
  deadline: string | null;
  deadlineState: string | null;
  lastActivity: string | null;
  createdAt: string;
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

enum SortByValues {
  LastActivity = "Last Activity",
  Deadline = "Deadline",
  Company = "Company",
  CreatedDate = "Date Created",
  DontSort = "Don't Sort",
}

enum FilterByValues {
  Stage = "Stage",
  JobLocation = "Location",
  DeadlineState = "Deadline State",
  NoFilter = "No Filter",
}

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
  const {
    _userId,
    jobs: rawJobs,
    username,
    metrics,
  } = useLoaderData() as DashboardData;
  const navigate = useNavigate();
  const { getToken } = useAuth();

  // Tracking sort/filter state
  const [sortProperty, setSortProperty] = useState(SortByValues.CreatedDate);
  const [filterProperty, setFilterProperty] = useState(FilterByValues.NoFilter);
  const [selectedCriteriaValue, setSelectedCriteriaValue] =
    useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [jobForm, setJobForm] = useState({
    title: "",
    company: "",
    stage: "Interested",
    location: "",
    deadline: "",
    deadlineState: "No Deadline",
  });

  const clientJobs = useMemo(() => {
    return (rawJobs || []).map((rawJob) => ({
      id: Number(rawJob.id),
      title: String(rawJob.title),
      company: String(rawJob.company),
      stage: String(rawJob.stage),
      location: (rawJob.location as string) ?? null,
      deadline: (rawJob.deadline as string) ?? null,
      deadlineState: (rawJob.deadline_state as string) ?? null,
      lastActivity: (rawJob.last_activity as string) ?? null,
      createdAt: (rawJob.created_at as string) || new Date().toISOString(),
    }));
  }, [rawJobs]);

  const displayJobs = useMemo(() => {
    let updatedList = [...clientJobs];

    if (
      filterProperty !== FilterByValues.NoFilter &&
      selectedCriteriaValue.trim() !== ""
    ) {
      const lowercaseCriteria = selectedCriteriaValue.toLowerCase();

      updatedList = updatedList.filter((job) => {
        if (filterProperty === FilterByValues.Stage)
          return job.stage === selectedCriteriaValue;
        if (filterProperty === FilterByValues.DeadlineState)
          return (job.deadlineState ?? "") === selectedCriteriaValue;
        if (filterProperty === FilterByValues.JobLocation)
          return (job.location ?? "").toLowerCase().includes(lowercaseCriteria);
        return true;
      });
    }

    if (sortProperty !== SortByValues.DontSort) {
      updatedList.sort((a, b) => {
        if (sortProperty === SortByValues.Company)
          return (a.company ?? "").localeCompare(b.company ?? "");

        const dateA = new Date(
          sortProperty === SortByValues.LastActivity
            ? (a.lastActivity ?? 0)
            : sortProperty === SortByValues.Deadline
              ? (a.deadline ?? 0)
              : a.createdAt,
        ).getTime();

        const dateB = new Date(
          sortProperty === SortByValues.LastActivity
            ? (b.lastActivity ?? 0)
            : sortProperty === SortByValues.Deadline
              ? (b.deadline ?? 0)
              : b.createdAt,
        ).getTime();

        return dateB - dateA;
      });
    }

    return updatedList;
  }, [clientJobs, filterProperty, selectedCriteriaValue, sortProperty]);

  const uniqueStages = useMemo(
    () => Array.from(new Set(clientJobs.map((j) => j.stage))).filter(Boolean),
    [clientJobs],
  );
  const uniqueDeadlineStates = useMemo(
    () =>
      Array.from(new Set(clientJobs.map((j) => j.deadlineState))).filter(
        Boolean,
      ),
    [clientJobs],
  );

  const handleFilterJobs = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value as FilterByValues;
    setFilterProperty(selectedValue);
    setSelectedCriteriaValue("");
  };

  const handleCriteriaChange = (value: string) => {
    setSelectedCriteriaValue(value);
  };

  const handleSortJobs = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value as SortByValues;
    setSortProperty(selectedValue);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEditing = editingJobId !== null;
    const url = isEditing
      ? `${BACKEND_URL}/api/jobs/${editingJobId}`
      : `${BACKEND_URL}/api/jobs`;

    try {
      const token = await getToken();
      if (!token) return;

      await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: jobForm.title,
          company: jobForm.company,
          stage: jobForm.stage,
          location: jobForm.location || null,
          deadline: jobForm.deadline || null,
          deadline_state: jobForm.deadlineState,
        }),
      });

      setIsModalOpen(false);
      navigate(".", { replace: true });
    } catch (error) {
      console.error("Form submission failed", error);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!confirm("Are you sure you want to delete this tracking entry?"))
      return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        navigate(".", { replace: true });
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

              {/* Sort */}
              <div>
                <label htmlFor="options">Sort By</label>
                <select
                  id="sortBy"
                  value={sortProperty}
                  onChange={handleSortJobs}
                >
                  <option value={SortByValues.LastActivity}>
                    Last Activity
                  </option>
                  <option value={SortByValues.CreatedDate}>Date Created</option>
                  <option value={SortByValues.Deadline}>Deadline</option>
                  <option value={SortByValues.Company}>Company</option>
                  <option value={SortByValues.DontSort}>Don&apos;t Sort</option>
                </select>
              </div>

              {/* Filter */}
              <div>
                <label htmlFor="options">Filter By</label>
                <select
                  id="filterBy"
                  value={filterProperty}
                  onChange={handleFilterJobs}
                >
                  <option value={FilterByValues.Stage}>Stage</option>
                  <option value={FilterByValues.Location}>Location</option>
                  <option value={FilterByValues.DeadlineState}>
                    DeadlineState
                  </option>
                  <option value={FilterByValues.NoFilter}>No Filter</option>
                </select>
              </div>

              {/* Conditional Secondary Criteria Input */}
              {filterProperty !== FilterByValues.NoFilter && (
                <div>
                  <label htmlFor="filterCriteria">Select/Type Value</label>

                  {/* Dropdown for Stage */}
                  {filterProperty === FilterByValues.Stage && (
                    <select
                      id="filterCriteria"
                      value={selectedCriteriaValue}
                      onChange={(e) => handleCriteriaChange(e.target.value)}
                    >
                      <option value="">Select Stage...</option>
                      {uniqueStages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Dropdown for Deadline State */}
                  {filterProperty === FilterByValues.DeadlineState && (
                    <select
                      id="filterCriteria"
                      value={selectedCriteriaValue}
                      onChange={(e) => handleCriteriaChange(e.target.value)}
                    >
                      <option value="">Select State...</option>
                      {uniqueDeadlineStates.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Text Input for Location */}
                  {filterProperty === FilterByValues.JobLocation && (
                    <input
                      id="filterCriteria"
                      type="text"
                      placeholder="Type a city or 'Remote'..."
                      value={selectedCriteriaValue}
                      onChange={(e) => handleCriteriaChange(e.target.value)}
                    />
                  )}
                </div>
              )}

              {/* Add */}
              <button
                type="button"
                onClick={() => {
                  setEditingJobId(null);
                  setJobForm({
                    title: "",
                    company: "",
                    stage: "Interested",
                    location: "",
                    deadline: "",
                    deadlineState: "No Deadline",
                  });
                  setIsModalOpen(true);
                }}
                className="db-btn-add-job"
              >
                <span className="plus-icon">+</span>
                <span>Add Job</span>
              </button>
            </div>

            <div className="db-grid">
              {displayJobs.map((job) => (
                <div key={job.id} className="db-card">
                  <div>
                    <h4>{job.title}</h4>
                    <p className="db-card-company">🏢 {job.company}</p>
                    <p className="db-card-status">📋 Status: {job.stage}</p>
                    <p className="db-card-status">
                      📍 Location: {job.location}
                    </p>
                    <p className="db-card-status">
                      📅 Deadline: {job.deadline}
                    </p>
                    <p className="db-card-status">
                      ⚠️ Deadline State: {job.deadlineState}
                    </p>
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
                          location: job.location || "",
                          deadline: job.deadline || "",
                          deadlineState: job.deadlineState,
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
                  <option value="Interested">Interested</option>
                  <option value="Applied">Applied</option>
                  <option value="Interview">Interview</option>
                  <option value="Offer">Offer</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
              <div className="db-form-group">
                <label>Location</label>
                <input
                  type="text"
                  id="modalLocation"
                  required
                  placeholder="e.g. Houston, TX"
                  value={jobForm.location}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, location: e.target.value })
                  }
                />
              </div>
              <div className="db-form-group">
                <label>Deadline</label>
                <input
                  type="date"
                  id="modalDeadline"
                  required
                  value={jobForm.deadline || ""}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, deadline: e.target.value })
                  }
                />
              </div>
              <div className="db-form-group">
                <label htmlFor="modalDeadlineState">Tracking Stage</label>
                <select
                  id="modalDeadlineState"
                  value={jobForm.deadlineState}
                  onChange={(e) =>
                    setJobForm({ ...jobForm, deadlineState: e.target.value })
                  }
                >
                  <option value="No Deadline">No Deadline</option>
                  <option value="Upcoming">Upcoming</option>
                  <option value="Past">Past</option>
                  <option value="Extended">Extended</option>
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
