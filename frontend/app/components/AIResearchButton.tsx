import { useState } from "react";
import { useAuth } from "@clerk/react-router"; 

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
interface AIButtonProps {
  company: string;
  title: string;
  location: string | null;
  description: string | null;
  onResearchComplete: (generatedText: string) => void;
}

export function AIResearchButton({ company, title, location, description, onResearchComplete }: AIButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false); 
  const [customContext, setCustomContext] = useState(""); 
  const { getToken } = useAuth(); 

  const handleAIRequest = async () => {
    setLoading(true);
    try {
      const token = await getToken(); 
      
      const response = await fetch(`${BACKEND_URL}/api/ai/research`, {        
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          company_name: company,
          job_title: title,
          location: location || "",
          job_description: description || "",
          user_context: customContext 
        }),
      });

      if (!response.ok) throw new Error("API request failed");
      
      const data = await response.json();
      onResearchComplete(data.research_notes);
      setShowInput(false); 
    } catch (err) {
      console.error("🚨 AI BUTTON ERROR DETECTED:", err);
      alert("Failed to generate AI briefing.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-btn-container">
      {!showInput ? (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="db-btn-ai"
        >
          ✨ AI Brief
        </button>
      ) : (
        <div className="ai-input-panel">
          <textarea
            placeholder="Add extra focus context..."
            value={customContext}
            onChange={(e) => setCustomContext(e.target.value)}
            rows={2}
            className="ai-context-textarea"
          />
          <div className="ai-panel-actions">
            <button 
              type="button"
              onClick={() => setShowInput(false)} 
              className="ai-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAIRequest}
              disabled={loading}
              className="ai-btn-submit"
            >
              {loading ? "⌛..." : "Generate"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}