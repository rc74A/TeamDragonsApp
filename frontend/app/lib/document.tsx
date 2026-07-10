const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type DocType = "resume" | "cover_letter";

export interface UploadDocumentResult {
  message: string;
  document_id: number;
  version_id: number;
  version_number: number;
  download_url: string | null;
}

const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export interface UploadDocumentParams {
  file: File;
  docType: DocType;
  title: string; // NEW — required now
  getToken: () => Promise<string | null>;
  content?: string;
  jobSnapshot?: string;
}

export async function uploadDocument({
  file,
  docType,
  title,
  getToken,
  content = "",
  jobSnapshot = "{}",
}: UploadDocumentParams): Promise<UploadDocumentResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only DOCX, TXT, PNG, or JPEG files are allowed.");
  }
  if (!title.trim()) {
    throw new Error("Give this document a title.");
  }

  const token = await getToken();
  if (!token) throw new Error("Not authenticated.");

  const payload = {
    doc_type: docType,
    title: title.trim(),
    content,
    job_snapshot: jobSnapshot,
    file_name: file.name,
  };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("payload_str", JSON.stringify(payload));

  const response = await fetch(`${BACKEND_URL}/api/documents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail ?? "Upload failed.");
  }

  return response.json();
}

