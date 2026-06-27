import "./ResumeModal.css";

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

interface TailoredResume {
  profile: TailoredProfile;
  experience: TailoredExperience[];
  skills: TailoredSkill[];
  education: TailoredEducation[];
}

interface ResumeModalProps {
  resume: TailoredResume;
  onClose: () => void;
}

function groupSkills(skills: TailoredSkill[]): Record<string, TailoredSkill[]> {
  return skills.reduce((acc, skill) => {
    const key = skill.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(skill);
    return acc;
  }, {} as Record<string, TailoredSkill[]>);
}

export default function ResumeModal({ resume, onClose }: ResumeModalProps) {
  if (!resume) return null;  

  const { profile, experience, skills, education } = resume;
  const groupedSkills = groupSkills(skills);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="rm-backdrop" onClick={handleBackdropClick}>
      <div className="rm-modal">

        {/* Toolbar */}
        <div className="rm-toolbar">
          <span className="rm-toolbar-label">Resume Preview</span>
          <div className="rm-toolbar-actions">
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
                        <span className="rm-entry-org"> · {exp.organization}</span>
                      )}
                    </div>
                    <span className="rm-entry-dates">
                      {exp.start_date}{exp.end_date ? ` – ${exp.end_date}` : ""}
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
                        <span className="rm-entry-org"> in {edu.field_of_study}</span>
                      )}
                      {edu.school && (
                        <span className="rm-entry-org"> · {edu.school}</span>
                      )}
                    </div>
                    <span className="rm-entry-dates">
                      {edu.start_date}{edu.end_date ? ` – ${edu.end_date}` : ""}
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
    </div>
  );
}