import { useState, useEffect } from "react";
import type { DocType, DocumentItem } from "~/lib/documents"; // adjust path to match your types file

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTitle: string, newType: DocType) => void;
  getToken: () => Promise<string | null>;
  initialData: DocumentItem | null;
}

export default function DocumentModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: DocumentModalProps) {
  const [newTitle, setNewTitle] = useState(
    initialData ? `${initialData.title} (copy)` : "",
  );
  const [newType, setNewType] = useState<DocType>(
    initialData?.doc_type ?? "resume",
  );
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!newTitle.trim()) {
      setError("Give this document a title.");
      return;
    }
    onSuccess(newTitle.trim(), newType);
  };

  return (
    <div className="dm-backdrop" onClick={onClose}>
      <div className="dm-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="dm-title">Duplicate Document</h3>

        <div className="dm-form-group">
          <label htmlFor="dm-new-title">New title</label>
          <input
            id="dm-new-title"
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="dm-input"
            autoFocus
          />
        </div>

        <div className="dm-form-group">
          <label htmlFor="dm-new-type">Document type</label>
          <select
            id="dm-new-type"
            value={newType}
            onChange={(e) => setNewType(e.target.value as DocType)}
            className="dm-input"
          >
            <option value="resume">Resume</option>
            <option value="cover_letter">Cover letter</option>
          </select>
        </div>

        {error && <p className="dm-error">{error}</p>}

        <div className="dm-actions">
          <button
            type="button"
            className="dm-btn dm-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dm-btn dm-btn-confirm"
            onClick={handleConfirm}
          >
            Duplicate
          </button>
        </div>
      </div>
    </div>
  );
}
