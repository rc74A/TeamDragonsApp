import { useEffect, useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton, useAuth } from "@clerk/react-router";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/findjobs";
import "./app.css";
import "./dashboard.css"; // Ngl I'm way too lazy so we're doing this

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type DocType = "resume" | "cover_letter";
type SortBy = "created_at" | "file_name";
type Order = "asc" | "desc";

interface DocumentVersion {
  id: number;
  version_number: number;
  file_name: string;
  created_at: string;
  download_url: string | null;
}

interface DocumentItem {
  id: number;
  doc_type: DocType;
  created_at: string;
  latest_version: DocumentVersion;
}

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (!userId) throw redirect("/login");
}

const Spinner = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4 rounded-xl p-6 shadow-2xl dark:bg-zinc-900">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-300 border-t-indigo-600" />

      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        loading...
      </p>
    </div>
  </div>
);

export default function Documents() {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [filterType, setFilterType] = useState<DocType | "all">("all");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [order, setOrder] = useState<Order>("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);

  const { getToken } = useAuth();

  const handleSortDocuments = () => {};

  const handleFilterDocuments = () => {};

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError("");

      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({ sort_by: sortBy, order });
      if (filterType !== "all") params.set("doc_type", filterType);

      const response = await fetch(
        `${BACKEND_URL}/api/documents?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.detail ?? "Failed to load documents.");
        return;
      }

      const data: DocumentItem[] = await response.json();
      setDocuments(data);
    } catch {
      setError("Network error while retrieving documents.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, sortBy, order]);

  const toggleVersionHistory = async (docId: number) => {
    if (expandedId === docId) {
      setExpandedId(null);
      setVersions([]);
      return;
    }

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(
        `${BACKEND_URL}/api/documents/${docId}/versions`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.ok) return;

      const data: DocumentVersion[] = await response.json();
      setVersions(data);
      setExpandedId(docId);
    } catch {
      setError("Couldn't load version history.");
    }
  };

  return (
    <div className="db-root">
      {isLoading && <Spinner label="loading..." />}

      <header className="db-header">Dragon Application</header>
      <div className="db-workspace">
        <aside className="sidebar">
          <ul>
            <li>
              <Link to="/" className="nav-link">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/documents" className="nav-link-active">
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
      </div>
      <main className="db-main">
        <div className="db-toolbar">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as DocType | "all")}
            className="db-select"
          >
            <option value="all">All documents</option>
            <option value="resume">Resumes</option>
            <option value="cover_letter">Cover letters</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="db-select"
          >
            <option value="created_at">Sort by date</option>
            <option value="file_name">Sort by name</option>
          </select>

          <button
            type="button"
            onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
            className="db-btn-add-job"
          >
            {order === "asc" ? "Oldest first" : "Newest first"}
          </button>
        </div>

        {error && <p className="db-error">{error}</p>}

        {!isLoading && documents.length === 0 && !error && (
          <p className="db-empty">
            No documents yet. Upload a resume or cover letter to see it here.
          </p>
        )}

        <div className="db-grid">
          {documents.map((doc) => (
            <div key={doc.id} className="db-card">
              <div className="db-card-type">
                {doc.doc_type === "resume" ? "Resume" : "Cover Letter"}
              </div>
              <div className="db-card-name">{doc.latest_version.file_name}</div>
              <div className="db-card-meta">
                v{doc.latest_version.version_number} ·{" "}
                {new Date(doc.latest_version.created_at).toLocaleDateString()}
              </div>

              <div className="db-card-actions">
                {doc.latest_version.download_url && (
                  <a
                    href={doc.latest_version.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="db-btn-add-job"
                  >
                    Preview
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => toggleVersionHistory(doc.id)}
                  className="db-btn-add-job"
                >
                  {expandedId === doc.id ? "Hide history" : "History"}
                </button>
              </div>

              {expandedId === doc.id && (
                <ul className="db-version-list">
                  {versions.map((v) => (
                    <li key={v.id}>
                      v{v.version_number} —{" "}
                      {new Date(v.created_at).toLocaleDateString()}{" "}
                      {v.download_url && (
                        <a
                          href={v.download_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
