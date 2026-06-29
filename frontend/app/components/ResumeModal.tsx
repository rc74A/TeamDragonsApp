import React, { useState } from "react";
import { useAuth } from "@clerk/react-router";
import type { FoundJob } from "~/routes/findjobs";
import "./ResumeModal.css";

const BACKEND_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface TailoredProfile {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
}

interface TailoredExperience {
  entry_type: string;
  title: string;
  organization: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface TailoredSkill {
  name: string;
  category: string;
  proficiency: string;
}

interface TailoredEducation {
  school: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date: string;
  gpa: string;
  description: string;
}

export interface TailoredResume {
  profile: TailoredProfile;
  experience: TailoredExperience[];
  skills: TailoredSkill[];
  education: TailoredEducation[];
}

interface ResumeModalProps {
  resume: TailoredResume;
  job: FoundJob;
  onClose: () => void;
}

function groupSkills(skills: TailoredSkill[]): Record<string, TailoredSkill[]> {
  return skills.reduce(
    (acc, skill) => {
      const key = skill.category || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(skill);
      return acc;
    },
    {} as Record<string, TailoredSkill[]>,
  );
}

export default function ResumeModal({
  resume,
  job,
  onClose,
}: ResumeModalProps) {
  const { getToken } = useAuth();
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"error" | "success">("error");
  const [rewriteModalOpen, setRewriteModalOpen] = useState(false);
  const [rewritePrompt, setRewritePrompt] = useState("");
  const [activeResume, setActiveResume] = useState<TailoredResume>(resume);
  const [newResume, setNewResume] = useState<TailoredResume | null>(null);

  if (!resume) return null;

  const isWide = rewriteModalOpen || newResume !== null;

  const { profile, experience, skills, education } = resume;
  const groupedSkills = groupSkills(skills);
  // For the rewrite logic
  const {
    profile: newProfile,
    experience: newExperience,
    skills: newSkills,
    education: newEducation,
  } = newResume ?? {};
  const newGroupedSkills = newSkills ? groupSkills(newSkills) : null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    try {
      setError("");
      setErrorType("error");

      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/save_resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job: job,
          resume: resume,
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

      setError("Succeeded in saving resume!");
      setErrorType("success");
    } catch {
      setError("Network error while saving resume.");
      setErrorType("error");
    }
  };

  const handleRewrite = async () => {
    try {
      setError("");
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/api/ai/rewrite_resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          job,
          existing_resume: resume,
          rewrite_prompt: rewritePrompt,
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

      const newResume: TailoredResume = await response.json();
      setNewResume(newResume);
      setErrorType("success");
      setError("Rewrite complete!");
    } catch {
      setErrorType("error");
      setError("Network error while rewriting resume.");
    }
  };

  const handleUseNew = () => {
    if (!newResume) return;
    setActiveResume(newResume);
    setRewriteModalOpen(false);
    setRewritePrompt("");
    setNewResume(null);
    setErrorType("success");
    setError("Now showing rewritten version.");
  };

  return (
    <div className="rm-backdrop" onClick={handleBackdropClick}>
      <div className={`rm-modal${isWide ? " rm-modal--wide" : ""}`}>
        {/* Toolbar */}
        <div className="rm-toolbar">
          <span className="rm-toolbar-label">resume Letter Preview</span>
          {error && (
            <p
              className={
                errorType === "success" ? "rm-msg-success" : "rm-msg-error"
              }
            >
              {error}
            </p>
          )}
          <div className="rm-toolbar-actions">
            <button type="button" className="rm-btn-print" onClick={handleSave}>
              Save
            </button>
            <button
              type="button"
              className="rm-btn-print"
              onClick={() => setRewriteModalOpen((o) => !o)}
            >
              {rewriteModalOpen ? "Hide Rewrite" : "Rewrite"}
            </button>
            <button
              type="button"
              className="rm-btn-print"
              onClick={() => window.print()}
            >
              Download / Print
            </button>
            <button type="button" className="rm-btn-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Papers row */}
        <div className="rm-papers-row">
          {/* Original */}
          <div className="rm-paper-wrap">
            <p className="rm-paper-label">Original</p>
            {/* Resume paper */}
            <div className="rm-paper" id="resume-paper">
              {/* Header */}
              <header className="rm-header">
                <h1 className="rm-name">{profile.full_name}</h1>
                <div className="rm-contact">
                  {profile.email && <span>{profile.email}</span>}
                  {profile.phone && <span>{profile.phone}</span>}
                  {profile.location && <span>{profile.location}</span>}
                </div>
                {profile.summary && (
                  <p className="rm-summary">{profile.summary}</p>
                )}
              </header>

              {/* Experience */}
              {experience.length > 0 && (
                <section className="rm-section">
                  <h2 className="rm-section-title">Experience</h2>
                  <div className="rm-section-rule" />
                  {experience.map((exp, i) => (
                    <div key={i} className="rm-entry">
                      <div className="rm-entry-header">
                        <div>
                          <span className="rm-entry-title">{exp.title}</span>
                          {exp.organization && (
                            <span className="rm-entry-org">
                              {" "}
                              · {exp.organization}
                            </span>
                          )}
                        </div>
                        <span className="rm-entry-dates">
                          {exp.start_date}
                          {exp.end_date ? ` – ${exp.end_date}` : ""}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="rm-entry-desc">{exp.description}</p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {/* Education */}
              {education.length > 0 && (
                <section className="rm-section">
                  <h2 className="rm-section-title">Education</h2>
                  <div className="rm-section-rule" />
                  {education.map((edu, i) => (
                    <div key={i} className="rm-entry">
                      <div className="rm-entry-header">
                        <div>
                          <span className="rm-entry-title">{edu.degree}</span>
                          {edu.field_of_study && (
                            <span className="rm-entry-org">
                              {" "}
                              in {edu.field_of_study}
                            </span>
                          )}
                          {edu.school && (
                            <span className="rm-entry-org">
                              {" "}
                              · {edu.school}
                            </span>
                          )}
                        </div>
                        <span className="rm-entry-dates">
                          {edu.start_date}
                          {edu.end_date ? ` – ${edu.end_date}` : ""}
                          {edu.gpa ? ` · GPA ${edu.gpa}` : ""}
                        </span>
                      </div>
                      {edu.description && (
                        <p className="rm-entry-desc">{edu.description}</p>
                      )}
                    </div>
                  ))}
                </section>
              )}

              {/* Skills */}
              {skills.length > 0 && (
                <section className="rm-section">
                  <h2 className="rm-section-title">Skills</h2>
                  <div className="rm-section-rule" />
                  <div className="rm-skills-grid">
                    {Object.entries(groupedSkills).map(([category, items]) => (
                      <div key={category} className="rm-skill-group">
                        <span className="rm-skill-category">{category}</span>
                        <span className="rm-skill-list">
                          {items.map((s) => s.name).join(", ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Rewrite panel */}
          {rewriteModalOpen && (
            <>
              <div className="rm-paper-divider" />
              <div className="rm-rewrite-panel">
                <div className="rm-toolbar">
                  <span className="rm-toolbar-label">Rewrite</span>
                  <div className="rm-toolbar-actions">
                    <button
                      type="button"
                      className="rm-btn-print"
                      onClick={handleRewrite}
                    >
                      Submit
                    </button>
                    <button
                      type="button"
                      className="rm-btn-close"
                      onClick={() => setRewriteModalOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="rm-rewrite-body">
                  <p className="rm-rewrite-label">
                    Describe how you&apos;d like the resume changed:
                  </p>
                  <textarea
                    className="rm-rewrite-input"
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
          {newResume && (
            <>
              <div className="rm-paper-divider" />
              <div className="rm-paper-wrap">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingRight: "1.25rem",
                  }}
                >
                  <p className="rm-paper-label">Rewritten</p>
                  <button
                    type="button"
                    className="rm-btn-success"
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
                {/* Resume paper */}
                <div className="rm-paper" id="resume-paper">
                  {/* Header */}
                  <header className="rm-header">
                    <h1 className="rm-name">{newProfile.full_name}</h1>
                    <div className="rm-contact">
                      {newProfile.email && <span>{newProfile.email}</span>}
                      {newProfile.phone && <span>{newProfile.phone}</span>}
                      {newProfile.location && (
                        <span>{newProfile.location}</span>
                      )}
                    </div>
                    {newProfile.summary && (
                      <p className="rm-summary">{newProfile.summary}</p>
                    )}
                  </header>

                  {/* Experience */}
                  {experience.length > 0 && (
                    <section className="rm-section">
                      <h2 className="rm-section-title">Experience</h2>
                      <div className="rm-section-rule" />
                      {newExperience.map((exp, i) => (
                        <div key={i} className="rm-entry">
                          <div className="rm-entry-header">
                            <div>
                              <span className="rm-entry-title">
                                {exp.title}
                              </span>
                              {exp.organization && (
                                <span className="rm-entry-org">
                                  {" "}
                                  · {exp.organization}
                                </span>
                              )}
                            </div>
                            <span className="rm-entry-dates">
                              {exp.start_date}
                              {exp.end_date ? ` – ${exp.end_date}` : ""}
                            </span>
                          </div>
                          {exp.description && (
                            <p className="rm-entry-desc">{exp.description}</p>
                          )}
                        </div>
                      ))}
                    </section>
                  )}

                  {/* Education */}
                  {education.length > 0 && (
                    <section className="rm-section">
                      <h2 className="rm-section-title">Education</h2>
                      <div className="rm-section-rule" />
                      {newEducation.map((edu, i) => (
                        <div key={i} className="rm-entry">
                          <div className="rm-entry-header">
                            <div>
                              <span className="rm-entry-title">
                                {edu.degree}
                              </span>
                              {edu.field_of_study && (
                                <span className="rm-entry-org">
                                  {" "}
                                  in {edu.field_of_study}
                                </span>
                              )}
                              {edu.school && (
                                <span className="rm-entry-org">
                                  {" "}
                                  · {edu.school}
                                </span>
                              )}
                            </div>
                            <span className="rm-entry-dates">
                              {edu.start_date}
                              {edu.end_date ? ` – ${edu.end_date}` : ""}
                              {edu.gpa ? ` · GPA ${edu.gpa}` : ""}
                            </span>
                          </div>
                          {edu.description && (
                            <p className="rm-entry-desc">{edu.description}</p>
                          )}
                        </div>
                      ))}
                    </section>
                  )}

                  {/* Skills */}
                  {newSkills.length > 0 && (
                    <section className="rm-section">
                      <h2 className="rm-section-title">Skills</h2>
                      <div className="rm-section-rule" />
                      <div className="rm-skills-grid">
                        {Object.entries(newGroupedSkills).map(
                          ([category, items]) => (
                            <div key={category} className="rm-skill-group">
                              <span className="rm-skill-category">
                                {category}
                              </span>
                              <span className="rm-skill-list">
                                {items.map((s) => s.name).join(", ")}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
