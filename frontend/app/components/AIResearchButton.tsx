import { useState } from "react";
import "./AIResearchButton.css";

interface AIButtonProps {
  company: string;
  title: string;
  location?: string;
  description?: string;
  onResearchComplete: (text: string) => void;
}
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export function AIResearchButton({ company, title, location, description, onResearchComplete }: AIButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleAIRequest = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/research`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    company_name: company,
    job_title: title,
    location: location || "",
    job_description: description || ""
  }),
});

      if (!response.ok) throw new Error("API failed");
      
      const data = await response.json();
      onResearchComplete(data.research_notes);
    } catch (err) {
      alert("Failed to generate AI briefing. Verify your local backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
  type="button"
  onClick={handleAIRequest}
  disabled={loading}
  className="db-btn-ai"
>
  {loading ? "⌛ Analyzing..." : "✨ AI Brief"}
</button>
  );
}