import { useEffect, useState } from "react";
import { getAuth } from "@clerk/react-router/server";
import { SignOutButton, useAuth } from "@clerk/react-router";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/findjobs";
import { uploadDocument, type DocType } from "~/lib/document";
import DuplicateModal from "~/components/DuplicateModal";
import "./app.css";
import "./documents.css";
import "./dashboard.css";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

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
  title: string;
  created_at: string;
  is_archived: boolean;
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

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState<DocType>("resume");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [duplicatingItem, setDuplicatingItem] = useState<DocumentItem | null>(
    null,
  );
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archivedDocs, setArchivedDocs] = useState<DocumentItem[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);

  const { getToken } = useAuth();

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

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError("Choose a file first.");
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError("Give this document a title.");
      return;
    }

    try {
      setIsUploading(true);
      setUploadError("");

      await uploadDocument({
        file: uploadFile,
        docType: uploadDocType,
        title: uploadTitle,
        getToken,
      });

      setUploadFile(null);
      setUploadTitle("");
      await fetchDocuments();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => {
      fetchDocuments();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, sortBy, order]);

  const handleDuplicate = async (
    doc: DocumentItem,
    newTitle: string,
    newType: string,
  ) => {
    setIsLoading(true);
    setError("");

    try {
      const token = await getToken();
      const docId = doc.id;

      const response = await fetch(
        `${BACKEND_URL}/api/documents/duplicate/${docId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            title: newTitle,
            doc_type: newType,
          }),
        },
      );

      if (!response.ok) {
        setError(
          err instanceof Error ? err.message : "Failed to duplicate item.",
        );
      }

      await fetchDocuments();
    } catch (err: unknown) {
      setError(err.message || "Failed to duplicate item.");
    } finally {
      setDuplicateModalOpen(false);
      setIsLoading(false);
    }
  };

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

  const fetchArchivedDocuments = async () => {
    try {
      setIsLoadingArchived(true);
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        sort_by: "created_at",
        order: "desc",
        include_archived: "true",
      });

      const response = await fetch(
        `${BACKEND_URL}/api/documents?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) return;

      setArchivedDocs(await response.json());
    } finally {
      setIsLoadingArchived(false);
    }
  };

  const handleArchiveToggle = async (
    doc: DocumentItem,
    targetState: "archive" | "restore",
  ) => {
    try {
      const token = await getToken();
      const response = await fetch(
        `${BACKEND_URL}/api/documents/${doc.id}/${targetState}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error(`Failed to ${targetState} document.`);
      await fetchDocuments();
      await fetchArchivedDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    }
  };

  const openArchiveModal = () => {
    setArchiveModalOpen(true);
    fetchArchivedDocuments();
  };

  return (
    <div className="doc-root">
      {isLoading && <Spinner label="loading..." />}

      <header className="doc-header">Dragon Application</header>
      <div className="doc-workspace">
        <aside className="doc-sidebar">
          <ul>
            <li>
              <Link to="/" className="doc-nav-link">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/documents" className="doc-nav-link-active">
                Documents
              </Link>
            </li>
            <li>
              <Link to="/findjobs" className="doc-nav-link">
                Find Jobs
              </Link>
            </li>
            <li>
              <Link to="/profile" className="doc-nav-link">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/settings" className="doc-nav-link">
                Settings
              </Link>
            </li>
            <li className="doc-logout-item">
              <SignOutButton redirectUrl="/login">
                <button className="doc-btn-logout">Sign Out</button>
              </SignOutButton>
            </li>
          </ul>
        </aside>

        <main className="doc-main">
          <div className="doc-upload">
            <select
              value={uploadDocType}
              onChange={(e) => setUploadDocType(e.target.value as DocType)}
              className="doc-select"
            >
              <option value="resume">Resume</option>
              <option value="cover_letter">Cover letter</option>
            </select>

            <input
              type="text"
              placeholder="Title (e.g. Backend Resume)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              className="doc-input"
            />

            <input
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || !uploadFile || !uploadTitle.trim()}
              className="doc-btn"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>

            {uploadError && <p className="doc-error">{uploadError}</p>}
          </div>

          <div className="doc-toolbar">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DocType | "all")}
              className="doc-select"
            >
              <option value="all">All documents</option>
              <option value="resume">Resumes</option>
              <option value="cover_letter">Cover letters</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="doc-select"
            >
              <option value="created_at">Sort by date</option>
              <option value="file_name">Sort by name</option>
            </select>

            <button
              type="button"
              onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
              className="doc-btn doc-btn-ghost"
            >
              {order === "asc" ? "Descending" : "Ascending"}
            </button>
            <button
              type="button"
              onClick={openArchiveModal}
              className="doc-link-view-archived"
            >
              View archived
            </button>
          </div>

          {error && <p className="doc-error">{error}</p>}

          {!isLoading && documents.length === 0 && !error && (
            <p className="doc-empty">
              No documents yet. Upload a resume or cover letter to see it here.
            </p>
          )}

          <div className="doc-grid">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="doc-card"
                data-doc-type={doc.doc_type}
              >
                <div className="doc-card-type">
                  {doc.doc_type === "resume" ? "Resume" : "Cover Letter"}
                </div>
                <div className="doc-card-name">{doc.title}</div>
                <div className="doc-card-filename">
                  {doc.latest_version.file_name}
                </div>
                <div className="doc-card-meta">
                  v{doc.latest_version.version_number} ·{" "}
                  {new Date(doc.latest_version.created_at).toLocaleDateString()}
                </div>

                <div className="doc-card-actions">
                  {doc.latest_version.download_url && (
                    <a
                      href={doc.latest_version.download_url}
                      target="_blank"
                      rel="noreferrer"
                      className="doc-btn"
                    >
                      Preview
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicatingItem(doc);
                      setDuplicateModalOpen(true);
                    }}
                    className="doc-btn"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVersionHistory(doc.id)}
                    className="doc-btn doc-btn-ghost"
                  >
                    {expandedId === doc.id ? "Hide history" : "History"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveToggle(doc, "archive")}
                    className="doc-btn doc-btn-ghost"
                  >
                    Archive
                  </button>
                </div>

                {expandedId === doc.id && (
                  <ul className="doc-version-list">
                    {versions.map((v) => (
                      <li key={v.id}>
                        <span>
                          v{v.version_number} —{" "}
                          {new Date(v.created_at).toLocaleDateString()}
                        </span>
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

      {duplicateModalOpen && (
        <div className="db-modal-overlay">
          <div className="db-modal-content db-modal-content-small">
            <DuplicateModal
              className="db-modal-overlay db-modal-content db-modal-content-small"
              isOpen={duplicateModalOpen}
              onClose={() => setDuplicateModalOpen(false)}
              onSuccess={(newTitle, newType) => {
                handleDuplicate(duplicatingItem, newTitle, newType);
              }}
              getToken={getToken}
              initialData={duplicatingItem}
            />
          </div>
        </div>
      )}

      {archiveModalOpen && (
        <div
          className="doc-modal-overlay"
          onClick={() => setArchiveModalOpen(false)}
        >
          <div
            className="doc-archive-modal-frame"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="doc-archive-modal-header">
              <h3>Archived Documents</h3>
              <button
                type="button"
                className="doc-archive-close-btn"
                onClick={() => setArchiveModalOpen(false)}
              >
                ×
              </button>
            </div>

            {isLoadingArchived && <p>Loading...</p>}

            {!isLoadingArchived && archivedDocs.length === 0 && (
              <p className="doc-archive-empty-text">No archived documents.</p>
            )}

            <div className="doc-archive-list-container">
              {archivedDocs.map((doc) => (
                <div key={doc.id} className="doc-archive-item-card">
                  <div>
                    <p className="doc-archive-item-title">{doc.title}</p>
                    <p className="doc-archive-item-subtitle">
                      {doc.doc_type === "resume" ? "Resume" : "Cover Letter"} ·
                      v{doc.latest_version.version_number}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="doc-btn-restore"
                    onClick={() => handleArchiveToggle(doc, "restore")}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
