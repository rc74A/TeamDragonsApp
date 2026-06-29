import React, { useState } from "react";
import { useAuth } from "@clerk/react-router";
import type { FoundJob } from "~/routes/findjobs";
import "./CoverLetterModal.css";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface CoverLetter {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  date: string;
  hiring_manager: string;
  company: string;
  job_title: string;
  body: string;
}

interface CoverLetterModalProps {
  coverLetter: CoverLetter;
  job: FoundJob;
  onClose: () => void;
}

function PaperContent({
  letter,
  paragraphs,
}: {
  letter: CoverLetter;
  paragraphs: string[];
}) {
  return (
    <div className="cl-paper">
      <header className="cl-sender">
        <h1 className="cl-name">{letter.full_name}</h1>
        <div className="cl-contact">
          {letter.email && <span>{letter.email}</span>}
          {letter.phone && <span>{letter.phone}</span>}
          {letter.location && <span>{letter.location}</span>}
        </div>
      </header>

      {letter.date && <p className="cl-date">{letter.date}</p>}

      <div className="cl-recipient">
        {letter.hiring_manager && <p>{letter.hiring_manager}</p>}
        {letter.company && <p>{letter.company}</p>}
      </div>

      <p className="cl-salutation">
        Dear {letter.hiring_manager ? letter.hiring_manager : "Hiring Manager"},
      </p>

      <div className="cl-body">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>

      <div className="cl-signoff">
        <p>Sincerely,</p>
        <p className="cl-sig-name">{letter.full_name}</p>
      </div>
    </div>
  );
}

function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function CoverLetterModal({
  coverLetter,
  job,
  onClose,
}: CoverLetterModalProps) {
  const { getToken } = useAuth();
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"error" | "success">("error");
  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);
  const [rewritePrompt, setRewritePrompt] = useState("");

  const [activeLetter, setActiveLetter] = useState<CoverLetter>(coverLetter);
  const [newCoverLetter, setNewCoverLetter] = useState<CoverLetter | null>(
    null,
  );
  const [newParagraphs, setNewParagraphs] = useState<string[]>([]);

  const [prevCoverLetter, setPrevCoverLetter] = useState<CoverLetter | null>(
    coverLetter,
  );

  if (coverLetter !== prevCoverLetter) {
    setPrevCoverLetter(coverLetter);
    setActiveLetter(coverLetter);
  }

  // 3. Early return if there's no data yet
  if (!coverLetter) return null;

  // 4. Safely split the body text with a fallback string guard
  const paragraphs = splitParagraphs(activeLetter?.body || "");
  const isWide = rewriteModalOpen || newCoverLetter !== null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/save_cover_letter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ job, cover_letter: activeLetter }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setErrorType("error");
        if (typeof errorData.detail === "string") {
          setError(errorData.detail);
        } else if (Array.isArray(errorData.detail)) {
          setError(
            errorData.detail.map((e: { msg: string }) => e.msg).join(", "),
          );
        } else {
          setError("An unexpected error occurred.");
        }
        return;
      }

      setErrorType("success");
      setError("Cover letter saved!");
    } catch {
      setErrorType("error");
      setError("Network error while saving cover letter.");
    }
  };

  const handleRewrite = async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) return;

      const response = await fetch(
        `${BACKEND_URL}/api/ai/rewrite_cover_letter`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            job,
            existing_cover_letter: coverLetter,
            rewrite_prompt: rewritePrompt,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        setErrorType("error");
        if (typeof errorData.detail === "string") {
          setError(errorData.detail);
        } else if (Array.isArray(errorData.detail)) {
          setError(
            errorData.detail.map((e: { msg: string }) => e.msg).join(", "),
          );
        } else {
          setError("An unexpected error occurred.");
        }
        return;
      }

      const cover: CoverLetter = await response.json();
      setNewCoverLetter(cover);
      setNewParagraphs(splitParagraphs(cover.body));
      setErrorType("success");
      setError("Rewrite complete!");
    } catch {
      setErrorType("error");
      setError("Network error while rewriting cover letter.");
    }
  };

  const handleUseNew = () => {
    if (!newCoverLetter) return;
    setActiveLetter(newCoverLetter);
    setRewriteModalOpen(false);
    setRewritePrompt("");
    setNewCoverLetter(null);
    setNewParagraphs([]);
    setErrorType("success");
    setError("Now showing rewritten version.");
  };

  return (
    <div className="cl-backdrop" onClick={handleBackdropClick}>
      <div className={`cl-modal${isWide ? " cl-modal--wide" : ""}`}>
        {/* Toolbar */}
        <div className="cl-toolbar">
          <span className="cl-toolbar-label">Cover Letter Preview</span>
          {error && (
            <p
              className={
                errorType === "success" ? "cl-msg-success" : "cl-msg-error"
              }
            >
              {error}
            </p>
          )}
          <div className="cl-toolbar-actions">
            <button type="button" className="cl-btn-print" onClick={handleSave}>
              Save
            </button>
            <button
              type="button"
              className="cl-btn-print"
              onClick={() => setRewriteModalOpen((o) => !o)}
            >
              {rewriteModalOpen ? "Hide Rewrite" : "Rewrite"}
            </button>
            <button
              type="button"
              className="cl-btn-print"
              onClick={() => window.print()}
            >
              Download / Print
            </button>
            <button type="button" className="cl-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Papers row */}
        <div className="cl-papers-row">
          {/* Original */}
          <div className="cl-paper-wrap">
            <p className="cl-paper-label">Original</p>
            <PaperContent letter={activeLetter} paragraphs={paragraphs} />
          </div>

          {/* Rewrite panel */}
          {rewriteModalOpen && (
            <>
              <div className="cl-paper-divider" />
              <div className="cl-rewrite-panel">
                <div className="cl-toolbar">
                  <span className="cl-toolbar-label">Rewrite</span>
                  <div className="cl-toolbar-actions">
                    <button
                      type="button"
                      className="cl-btn-print"
                      onClick={handleRewrite}
                    >
                      Submit
                    </button>
                    <button
                      type="button"
                      className="cl-btn-close"
                      onClick={() => setRewriteModalOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="cl-rewrite-body">
                  <p className="cl-rewrite-label">
                    Describe how you&apos;d like the cover letter changed:
                  </p>
                  <textarea
                    className="cl-rewrite-input"
                    value={rewritePrompt}
                    onChange={(e) => setRewritePrompt(e.target.value)}
                    placeholder="e.g. Make it more formal, emphasize Python experience..."
                    rows={6}
                  />
                </div>
              </div>
            </>
          )}

          {/* Rewritten version */}
          {newCoverLetter && (
            <>
              <div className="cl-paper-divider" />
              <div className="cl-paper-wrap">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingRight: "1.25rem",
                  }}
                >
                  <p className="cl-paper-label">Rewritten</p>
                  <button
                    type="button"
                    className="cl-btn-success"
                    style={{
                      fontSize: "0.68rem",
                      padding: "0.2rem 0.6rem",
                      marginTop: "0.4rem",
                    }}
                    onClick={handleUseNew}
                  >
                    Use New ✓
                  </button>
                </div>
                <PaperContent
                  letter={newCoverLetter}
                  paragraphs={newParagraphs}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
