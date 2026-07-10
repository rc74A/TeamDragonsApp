import { useState } from "react";
import { type DocType } from "~/lib/document";

interface DuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  getToken: () => Promise<string | null>;
  initialData?: { title: string; doc_type: DocType };
}

export default function DuplicateModal({
  isOpen,
  onClose,
  onSuccess,
  getToken,
  initialData,
}: DuplicateModalProps) {
  const [title, setTitle] = useState(
    initialData ? `${initialData.title} (Copy)` : "",
  );
  const [docType, setDocType] = useState<DocType>(
    initialData?.doc_type ?? "resume",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      onSuccess(title, docType);
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="db-modal-overlay">
      {/* Specific small container utility class to keep the form look clean */}
      <div className="db-modal-content db-modal-content-small">
        <h3>{initialData ? "Duplicate Document" : "Upload Document"}</h3>

        {error && <p className="db-error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="db-form-group">
            <label>Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              placeholder="Enter document title..."
            />
          </div>

          <div className="db-form-group">
            <label>Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocType)}
              disabled={loading}
            >
              <option value="resume">Resume</option>
              <option value="cover_letter">Cover Letter</option>
            </select>
          </div>

          <div className="db-form-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="db-btn-cancel"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="db-btn-submit">
              {loading ? "Processing..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
