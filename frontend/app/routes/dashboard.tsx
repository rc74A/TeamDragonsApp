import React, { useState, useMemo } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton, useAuth } from "@clerk/react-router";
import { useLoaderData, Link, useNavigate, redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import { uploadDocument, type DocType } from "~/lib/document";
import AnalyticsPanel from "../components/AnalyticsPanel";
import "./app.css";
import "./dashboard.css";

interface Job {
  id: number;
  title: string;
  company: string;
  stage: string;
  location: string | null;
  description: string | null;
  deadline: string | null;
  deadlineState: string | null;
  interview_notes: string | null;
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
interface TimelineEntry {
  id: number;
  job_id: number;
  old_stage: string;
  new_stage: string;
  changed_at: string;
}

interface Interview {
  id: number;
  job_id: number;
  round_type: string; // e.g., Phone Screen, Technical, Behavioral, Management
  interview_date: string;
  notes: string | null;
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

const stageTransitions = {
  Interested: ["Interested", "Applied", "Rejected"],
  Applied: ["Applied", "Interview", "Rejected"],
  Interview: ["Interview", "Offer", "Rejected"],
  Offer: ["Offer", "Archived", "Rejected"],
  Rejected: ["Rejected"],
  Archived: ["Archived"],
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

  const username = (sessionClaims?.email as string) ?? "User";

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
  const { jobs: rawJobs, username, metrics } = useLoaderData() as DashboardData;
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
    description: "",
    deadline: "",
    deadlineState: "No Deadline",
    interview_notes: "",
    outcomeState: "",
    outcomeNotes: "",
  });

  const [timelineData, setTimelineData] = useState<TimelineEntry[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const [interviewForm, setInterviewForm] = useState({
    roundType: "Technical",
    interviewDate: "",
    notes: "",
  });

  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingInterviews, setLoadingInterviews] = useState(false);

  const [isArchiveViewOpen, setIsArchiveViewOpen] = useState(false);
  const [archivedJobs, setArchivedJobs] = useState<unknown[]>([]);
  const fetchArchivedJobs = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/jobs/archived`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setArchivedJobs(data);
      }
    } catch (err) {
      console.error("Failed to load archived repository:", err);
    }
  };

  const clientJobs = useMemo(() => {
    return ((rawJobs as unknown as Record<string, unknown>[]) || []).map(
      (rawJob) => ({
        id: Number(rawJob.id),
        title: String(rawJob.title),
        company: String(rawJob.company),
        stage: String(rawJob.stage),
        location: (rawJob.location as string) ?? null,
        description: String(rawJob.description),
        deadline: (rawJob.deadline as string) ?? null,
        deadlineState: (rawJob.deadline_state as string) ?? null,
        interview_notes: String(rawJob.interview_notes),
        lastActivity: (rawJob.last_activity as string) ?? null,
        createdAt: (rawJob.created_at as string) || new Date().toISOString(),
        outcome_state: (rawJob.outcome_state as string) ?? null,
        outcome_notes: (rawJob.outcome_notes as string) ?? null,
      }),
    );
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

  const fetchJobInterviews = async (jobId: number) => {
    setLoadingInterviews(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}/interviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInterviews(data);
      }
    } catch (err) {
      console.error("Failed to load interview rounds:", err);
    } finally {
      setLoadingInterviews(false);
    }
  };

  const handleAddInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJobId) return;

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(
        `${BACKEND_URL}/api/jobs/${editingJobId}/interviews`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            round_type: interviewForm.roundType,
            interview_date: interviewForm.interviewDate,
            notes: interviewForm.notes || null,
          }),
        },
      );

      if (response.ok) {
        setInterviewForm({
          roundType: "Technical",
          interviewDate: "",
          notes: "",
        });
        fetchJobInterviews(editingJobId);
        fetchJobTimeline(editingJobId);
      } else {
        console.error(
          "Backend rejected the interview save request. Status:",
          response.status,
        );
      }
    } catch (error) {
      console.error("Failed to append interview record:", error);
    }
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
          description: jobForm.description,
          deadline: jobForm.deadline || null,
          deadline_state: jobForm.deadlineState,
          outcome_state: jobForm.outcomeState || null,
          outcome_notes: jobForm.outcomeNotes || null,
        }),
      });

      setIsModalOpen(false);
      navigate(".", { replace: true });
    } catch (error) {
      console.error("Form submission failed", error);
    }
  };

  const handleInlineStageChange = async (
    jobId: number,
    currentJob: Record<string, unknown>,
    newStage: string,
  ) => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/jobs/${jobId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: currentJob.title,
          company: currentJob.company,
          stage: newStage,
          location: currentJob.location,
          deadline: currentJob.deadline,
          deadline_state: currentJob.deadlineState,
          outcome_state: currentJob.outcome_state || null,
          outcome_notes: currentJob.outcome_notes || null,
        }),
      });

      if (response.ok) {
        // Refresh router context to update pipeline cards & dashboard metric states
        navigate(".", { replace: true });
      }
    } catch (error) {
      console.error("Inline stage transition failed:", error);
    }
  };

  const fetchJobTimeline = async (jobId: number) => {
    setLoadingTimeline(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${BACKEND_URL}/api/jobs/${jobId}/timeline`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTimelineData(data);
      }
    } catch (err) {
      console.error("Failed to load timeline records:", err);
    } finally {
      setLoadingTimeline(false);
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

  /*
  const handleGenerateResume() = async () => {
  await uploadDocument({
      file: generatedPdfFile,
      docType: "cover_letter",
      content: generatedText,
      jobSnapshot: JSON.stringify(foundJob),
      getToken,
    });
  }
    */

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
              <Link to="/documents" className="nav-link">
                Documents
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

            <AnalyticsPanel />

            <div className="db-section-header">
              <h3>Job Applications</h3>

              {/* Sort */}
              <div>
                <label htmlFor="options">Sort By</label>
                <select
                  id="sortBy"
                  aria-label="Sort job applications list"
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
                  aria-label="Filter job applications list"
                  value={filterProperty}
                  onChange={handleFilterJobs}
                >
                  <option value={FilterByValues.Stage}>Stage</option>
                  <option value={FilterByValues.JobLocation}>Location</option>
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
                    outcomeState: "",
                    outcomeNotes: "",
                    description: "",
                    interview_notes: "",
                  });
                  setIsModalOpen(true);
                }}
                className="db-btn-add-job"
              >
                <span className="plus-icon">+</span>
                <span>Add Job</span>
              </button>

              {/* Archive View Toggle */}
              <button
                type="button"
                onClick={() => {
                  setIsArchiveViewOpen(true);
                  fetchArchivedJobs();
                }}
                className="db-link-view-archived"
              >
                📁 View Archived Positions
              </button>
            </div>

            <div className="db-grid">
              {displayJobs.map((job) => (
                <div key={job.id} className="db-card">
                  <div>
                    <h4>{job.title}</h4>
                    <p className="db-card-company"> {job.description}</p>
                    <p className="db-card-company">🏢 {job.company}</p>
                    <div className="db-inline-stage-wrapper">
                      <span className="db-card-status">📋 Status:</span>
                      <select
                        value={job.stage}
                        aria-label={`Change pipeline stage for ${job.title}`}
                        onChange={(e) =>
                          handleInlineStageChange(job.id, job, e.target.value)
                        }
                        className="db-card-inline-select"
                      >
                        <option value="Wishlist">Wishlist</option>
                        <option value="Applied">Applied</option>
                        <option value="Interviewing">Interviewing</option>
                        <option value="Offer">Offer</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
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
                          description: job.description,
                          deadline: job.deadline || "",
                          deadlineState: job.deadlineState,
                          interview_notes: job.interview_notes,
                          outcomeState: "",
                          outcomeNotes: "",
                        });
                        setIsModalOpen(true);
                        fetchJobInterviews(job.id);
                        fetchJobTimeline(job.id);
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
          {/* Managed purely via CSS file targeting hooks */}
          <div
            className={`db-modal-content ${editingJobId ? "db-modal-expanded" : ""}`}
          >
            <div className="db-modal-split">
              {/* LEFT COLUMN: Input form data elements */}
              <div className="db-modal-col-left">
                <h3 className="db-modal-title-blue">
                  {editingJobId
                    ? "✏️ Edit Position Details"
                    : "➕ Post a New Tracking Entry"}
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
                      aria-label="Select current application tracking stage"
                      onChange={(e) =>
                        setJobForm({ ...jobForm, stage: e.target.value })
                      }
                    >
                      {stageTransitions[jobForm.stage].map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
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
                  {/* 🌟 KEPT FROM MAIN: Description Form Group Input field block */}
                  <div className="db-form-group">
                    <label>Description</label>
                    <input
                      type="text"
                      id="modalDescription"
                      required
                      placeholder="add description"
                      value={jobForm.description}
                      onChange={(e) =>
                        setJobForm({ ...jobForm, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="db-form-group">
                    <label htmlFor="modalDeadline">Deadline</label>
                    <input
                      id="modalDeadline"
                      type="date"
                      required
                      value={jobForm.deadline || ""}
                      onChange={(e) =>
                        setJobForm({ ...jobForm, deadline: e.target.value })
                      }
                    />
                  </div>
                  <div className="db-form-group">
                    <label htmlFor="modalDeadlineState">Deadline State</label>
                    <select
                      id="modalDeadlineState"
                      aria-label="Select deadline status state"
                      value={jobForm.deadlineState}
                      onChange={(e) =>
                        setJobForm({
                          ...jobForm,
                          deadlineState: e.target.value,
                        })
                      }
                    >
                      <option value="No Deadline">No Deadline</option>
                      <option value="Upcoming">Upcoming</option>
                      <option value="Past">Past</option>
                      <option value="Extended">Extended</option>
                    </select>
                  </div>

                  {/* S2-013: Terminal Conclusion Tracking Panel Block */}
                  {editingJobId && (
                    <div className="db-outcome-panel">
                      <h4 className="db-outcome-title">🏁 Terminal Outcome </h4>
                      <div className="db-form-group">
                        <label htmlFor="modalOutcomeState">
                          Conclusion State
                        </label>
                        <select
                          id="modalOutcomeState"
                          aria-label="Select terminal job application conclusion state"
                          value={jobForm.outcomeState}
                          onChange={(e) =>
                            setJobForm({
                              ...jobForm,
                              outcomeState: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            In Progress / Active Pipeline...
                          </option>
                          <option value="Offer Accepted">
                            Offer Accepted 🍾
                          </option>
                          <option value="Offer Declined">Offer Declined</option>
                          <option value="Rejected">Rejected by Company</option>
                          <option value="Withdrawn">Withdrawn by Me</option>
                        </select>
                      </div>
                      <div className="db-form-group db-form-group-no-margin">
                        <label htmlFor="modalOutcomeNotes">
                          Conclusion Notes
                        </label>
                        <textarea
                          id="modalOutcomeNotes"
                          placeholder="Add any retrospective thoughts, final salary stats, or feedback details..."
                          value={jobForm.outcomeNotes}
                          rows={3}
                          className="db-outcome-textarea"
                          onChange={(e) =>
                            setJobForm({
                              ...jobForm,
                              outcomeNotes: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                  <div className="db-form-actions db-form-actions-spaced">
                    {/* S2-014: Render Archive button first to float left via CSS */}
                    {editingJobId && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              "Are you sure you want to archive this job application?",
                            )
                          )
                            return;

                          try {
                            const token = await getToken();
                            if (!token) return;

                            const res = await fetch(
                              `${BACKEND_URL}/api/jobs/${editingJobId}/archive`,
                              {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                              },
                            );

                            if (res.ok) {
                              setIsModalOpen(false);
                              window.location.reload();
                            }
                          } catch (err) {
                            console.error("Failed to archive job:", err);
                          }
                        }}
                        className="db-btn-archive"
                      >
                        📦 Archive Job
                      </button>
                    )}

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

              {/* RIGHT COLUMN: S2-010 Visual Chronological History Timeline Feed Panel */}
              {editingJobId && (
                <div className="db-modal-col-right">
                  <h3 className="db-modal-title-blue">⏱️ Activity Timeline</h3>
                  {loadingTimeline ? (
                    <p className="db-timeline-loading">
                      Syncing chronological logs...
                    </p>
                  ) : timelineData.length === 0 ? (
                    <p className="db-timeline-empty">
                      No stage transitions recorded yet. Changes you save above
                      will build logs here!
                    </p>
                  ) : (
                    <div className="db-timeline-container">
                      {timelineData.map((entry, index) => (
                        <div key={entry.id} className="db-timeline-node">
                          {/* Chronological Connector Graphics wireframe elements */}
                          <div className="db-timeline-axis">
                            <div className="db-timeline-dot" />
                            {index !== timelineData.length - 1 && (
                              <div className="db-timeline-line" />
                            )}
                          </div>

                          {/* Historical Node Description Label Cards */}
                          <div className="db-timeline-card">
                            <div className="db-timeline-time">
                              {(() => {
                                const utcString = entry.changed_at.endsWith("Z")
                                  ? entry.changed_at
                                  : `${entry.changed_at}Z`;

                                return new Date(utcString).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });
                              })()}
                            </div>
                            <div className="db-timeline-text">
                              Moved from{" "}
                              <span className="db-timeline-old-stage">
                                {entry.old_stage}
                              </span>{" "}
                              →{" "}
                              <span className="db-timeline-new-stage">
                                {entry.new_stage}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <hr className="db-modal-divider" />
                  {/* S2-011: Interview Tracking Management Panel */}
                  <h3 className="db-modal-title-blue view-title-spacing">
                    🎙️ Scheduled Interviews
                  </h3>

                  {loadingInterviews ? (
                    <p className="db-timeline-loading">
                      Syncing interview records...
                    </p>
                  ) : interviews.length === 0 ? (
                    <p className="db-timeline-empty interview-empty-margin">
                      No interview rounds logged for this position yet.
                    </p>
                  ) : (
                    <div className="db-interview-list">
                      {interviews.map((iv) => (
                        <div
                          key={iv.id}
                          className="db-timeline-card db-interview-card-accent"
                        >
                          <div className="db-timeline-time db-interview-type-highlight">
                            {iv.round_type} Round
                          </div>
                          <div className="db-timeline-time">
                            📅{" "}
                            {(() => {
                              if (!iv.interview_date) return "Date Pending";

                              // Append generic seconds string if raw local string format lacks it
                              const safeDateStr =
                                iv.interview_date.includes("T") &&
                                !iv.interview_date.endsWith("Z")
                                  ? `${iv.interview_date}:00`
                                  : iv.interview_date;

                              const parsedDate = new Date(safeDateStr);

                              // If parsing fails completely, fallback safely onto raw string
                              return isNaN(parsedDate.getTime())
                                ? iv.interview_date
                                : parsedDate.toLocaleString([], {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                            })()}
                          </div>
                          {iv.notes && (
                            <p className="db-timeline-text db-interview-notes-text">
                              📝 {iv.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Interview Sub-Form Component */}
                  <form
                    onSubmit={handleAddInterview}
                    className="db-interview-subform"
                  >
                    <h4 className="db-interview-subform-title">
                      Log an Interview Round
                    </h4>

                    <div className="db-form-group subform-group-spacing">
                      <label htmlFor="interviewRoundType">Round Type</label>
                      <select
                        id="interviewRoundType"
                        value={interviewForm.roundType}
                        onChange={(e) =>
                          setInterviewForm({
                            ...interviewForm,
                            roundType: e.target.value,
                          })
                        }
                        className="subform-select-padding"
                      >
                        <option value="Phone Screen">Phone Screen</option>
                        <option value="Technical">Technical Interview</option>
                        <option value="Behavioral">Behavioral Interview</option>
                        <option value="Manager Round">Manager Round</option>
                        <option value="Onsite / Final">
                          Onsite / Final Round
                        </option>
                      </select>
                    </div>

                    <div className="db-form-group subform-group-spacing">
                      <label htmlFor="interviewDateTime">Date & Time</label>
                      <input
                        id="interviewDateTime"
                        type="datetime-local"
                        required
                        value={interviewForm.interviewDate}
                        onChange={(e) =>
                          setInterviewForm({
                            ...interviewForm,
                            interviewDate: e.target.value,
                          })
                        }
                        className="subform-select-padding"
                      />
                    </div>

                    <div className="db-form-group subform-group-spacing">
                      <label htmlFor="interviewNotes">Notes</label>
                      <input
                        id="interviewNotes"
                        type="text"
                        placeholder="e.g., LeetCode medium, system architecture..."
                        value={interviewForm.notes}
                        onChange={(e) =>
                          setInterviewForm({
                            ...interviewForm,
                            notes: e.target.value,
                          })
                        }
                        className="subform-select-padding"
                      />
                    </div>

                    <button
                      type="submit"
                      className="db-btn-submit subform-btn-layout"
                    >
                      + Save Interview Round
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {isArchiveViewOpen && (
        <div className="db-modal-overlay">
          <div className="db-archive-modal-frame">
            <div className="db-archive-modal-header">
              <h3>📁 Archived Job Applications</h3>
              <button
                onClick={() => setIsArchiveViewOpen(false)}
                className="db-archive-close-btn"
              >
                &times;
              </button>
            </div>

            {archivedJobs.length === 0 ? (
              <p className="db-archive-empty-text">
                No archived job records found.
              </p>
            ) : (
              <div className="db-archive-list-container">
                {(archivedJobs as unknown as Record<string, unknown>[]).map(
                  (job) => (
                    <div key={String(job.id)} className="db-archive-item-card">
                      <div className="db-archive-item-details">
                        <h4 className="db-archive-item-title">
                          {String(job.title)}
                        </h4>
                        <p className="db-archive-item-subtitle">
                          {String(job.company)}
                          {!job.outcome_state && (
                            <>
                              {" — "}
                              <span className="db-archive-item-stage">
                                {String(job.stage)}
                              </span>
                            </>
                          )}
                        </p>
                        {!!job.outcome_state && (
                          <span className="db-archive-item-outcome-badge">
                            Outcome: {String(job.outcome_state)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const token = await getToken();
                            if (!token) return;

                            const res = await fetch(
                              `${BACKEND_URL}/api/jobs/${job.id}/restore`,
                              {
                                method: "POST",
                                headers: { Authorization: `Bearer ${token}` },
                              },
                            );

                            if (res.ok) {
                              fetchArchivedJobs();
                              window.location.reload();
                            }
                          } catch (err) {
                            console.error("Failed to restore entry:", err);
                          }
                        }}
                        className="db-btn-restore"
                      >
                        ↩️ Restore
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
