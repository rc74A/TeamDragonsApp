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
  body: string; // AI-generated letter body (multiple paragraphs)
}

interface CoverLetterModalProps {
  coverLetter: CoverLetter;
  job: FoundJob;
  onClose: () => void;
}

export default function CoverLetterModal({
  coverLetter,
  job,
  onClose,
}: CoverLetterModalProps) {
  const { getToken } = useAuth();
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"error" | "success">("error");

  if (!coverLetter) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    try {
      setError("");
      setErrorType("error");

      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/save_cover_letter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job: job,
          cover_letter: coverLetter,
        }),
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

      setError("Succeeded in saving cover letter!");
      setErrorType("success");
    } catch {
      setError("Network error while saving cover letter.");
      setErrorType("error");
    }
  };

  // Split body into paragraphs on double newline or single newline
  const paragraphs = coverLetter.body
    .split(/\n\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="cl-backdrop" onClick={handleBackdropClick}>
      <div className="cl-modal">
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
              onClick={() => window.print()}
            >
              Download / Print
            </button>
            <button type="button" className="cl-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Paper */}
        <div className="cl-paper" id="cover-letter-paper">
          {/* Sender block */}
          <header className="cl-sender">
            <h1 className="cl-name">{coverLetter.full_name}</h1>
            <div className="cl-contact">
              {coverLetter.email && <span>{coverLetter.email}</span>}
              {coverLetter.phone && <span>{coverLetter.phone}</span>}
              {coverLetter.location && <span>{coverLetter.location}</span>}
            </div>
          </header>

          {/* Date */}
          {coverLetter.date && <p className="cl-date">{coverLetter.date}</p>}

          {/* Recipient block */}
          <div className="cl-recipient">
            {coverLetter.hiring_manager && <p>{coverLetter.hiring_manager}</p>}
            {coverLetter.company && <p>{coverLetter.company}</p>}
          </div>

          {/* Salutation */}
          <p className="cl-salutation">
            Dear{" "}
            {coverLetter.hiring_manager
              ? coverLetter.hiring_manager
              : "Hiring Manager"}
            ,
          </p>

          {/* Body */}
          <div className="cl-body">
            {paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {/* Sign-off */}
          <div className="cl-signoff">
            <p>Sincerely,</p>
            <p className="cl-sig-name">{coverLetter.full_name}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
