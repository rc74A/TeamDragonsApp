import { useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton, useAuth } from "@clerk/react-router";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/findjobs";
import ResumeModal from "~/components/ResumeModal";
import type { TailoredResume } from "~/components/ResumeModal";
import CoverLetterModal from "~/components/CoverLetterModal";
import type { CoverLetter } from "~/components/CoverLetterModal";
import "./app.css";
import "./findjobs.css";

export interface FoundJob {
  id: string;
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
  const { userId } = await getAuth(args);
  if (!userId) throw redirect("/login");
}

const Spinner = () => (
  <div className="spinner-overlay">
    <div className="spinner-box">
      <div className="spinner" />
      <p className="spinner-label">Searching for jobs...</p>
    </div>
  </div>
);

export default function FindJobs() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentResume, setCurrentResume] = useState<TailoredResume | null>(
    null,
  );
  const [currentCoverLetter, setCurrentCoverLetter] =
    useState<CoverLetter | null>(null);
  const [coverLetterModalOpen, setCoverLetterModalOpen] = useState(true);
  const [resumeModalOpen, setResumeModalOpen] = useState(true);
  const [searchForm, setSearchForm] = useState({
    title: "",
    employer: "",
    keywords: "",
    excluded_words: "",
  });

  const [jobs, setJobs] = useState<FoundJob[]>([
    {
      id: "0",
      title: "Test Job",
      employer: "Employer",
      description: "This is a normal job.",
      apply_link: "https://google.com",
      salary: 36000,
      employment_type: "Full-Time",
      country: "United States",
      state: "New Jersey",
      city: "Newark",
    },
  ]);
  const [selectedJob, setSelectedJob] = useState<FoundJob>();

  const { getToken } = useAuth();

  const handleSearchSubmit = async () => {
    try {
      setIsLoading(true);
      setError("");

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateResume = async (job: FoundJob) => {
    try {
      setIsLoading(true);
      setError("");

      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/create_resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          position_info: job.description,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail);
        console.error(errorData.detail);
        return;
      }

      const resume = await response.json();

      if (resume.length == 0) {
        setError("Failed to generate resume.");
        return;
      }

      setCurrentResume(resume);
      setResumeModalOpen(true);
      setError("");

      console.log(resume);
    } catch {
      setError("Network error while generating resume.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCover = async (job: FoundJob) => {
    try {
      setIsLoading(true);
      setError("");

      const token = await getToken();
      if (!token) return;

      const response = await fetch(
        `${BACKEND_URL}/api/ai/create_cover_letter`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            position_info: job.description,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail);
        console.error(errorData.detail);
        return;
      }

      const resume = await response.json();

      if (resume.length == 0) {
        setError("Failed to generate cover letter.");
        return;
      }

      setCurrentCoverLetter(resume);
      setCoverLetterModalOpen(true);
      setError("");

      console.log(resume);
    } catch {
      setError("Network error while generating cover letter.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="search-root">
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )}

      <header className="search-header">Dragon Application</header>
      <div className="search-workspace">
        <aside className="sidebar">
          <ul>
            <li>
              <Link to="/" className="nav-link">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/findjobs" className="nav-link-active">
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

        <main className="search-main">
          <div className="search-container">
            <h2 className="view-title">Find Jobs</h2>
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
              <h3>Search Results</h3>
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
                    <p className="search-card-company">{job.employment_type}</p>
                    <p className="search-card-company">
                      {job.country}, {job.state}, {job.city}
                    </p>
                    <a
                      className="search-card-company underline"
                      href={job.apply_link}
                    >
                      {" "}
                      Link{" "}
                    </a>{" "}
                    <br />
                    <br />
                    <p className="search-card-status">salary: {job.salary}</p>
                    <p className="search-card-company">{job.description}</p>
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
                        setSelectedJob(job);
                        handleGenerateResume(job);
                      }}
                      className="search-btn-add"
                    >
                      Create Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJob(job);
                        handleGenerateCover(job);
                      }}
                      className="search-btn-add"
                    >
                      Create Cover Letter
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

      {resumeModalOpen && (
        <ResumeModal
          resume={currentResume}
          job={selectedJob}
          onClose={() => {
            setResumeModalOpen(false);
            setCurrentResumeLetter(null);
          }}
        />
      )}

      {coverLetterModalOpen && (
        <CoverLetterModal
          coverLetter={currentCoverLetter}
          job={selectedJob}
          onClose={() => {
            setCoverLetterModalOpen(false);
            setCurrentCoverLetter(null);
          }}
        />
      )}
    </div>
  );
}
