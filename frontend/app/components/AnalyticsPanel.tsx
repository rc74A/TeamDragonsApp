import { useEffect, useState } from "react";
import { useAuth } from "@clerk/react-router";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface StageConversion {
  from_stage: string;
  to_stage: string;
  reached_from: number;
  reached_to: number;
  rate: number;
}

interface StageDwell {
  stage: string;
  avg_days: number;
  samples: number;
}

interface JobAnalytics {
  funnel: Record<string, number>;
  conversion: StageConversion[];
  time_in_stage: StageDwell[];
}

export default function AnalyticsPanel() {
  const { getToken } = useAuth();
  const [analytics, setAnalytics] = useState<JobAnalytics | null>(null);

  async function load() {
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/jobs/analytics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (
          data &&
          Array.isArray(data.conversion) &&
          Array.isArray(data.time_in_stage)
        ) {
          setAnalytics(data);
        }
      }
    } catch {
      // Backend offline: the dashboard still renders without analytics.
    }
  }

  useEffect(() => {
    // load() only sets state after an awaited fetch (async), not
    // synchronously — the standard on-mount data fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  if (!analytics) {
    return null;
  }

  const dwellWithData = analytics.time_in_stage.filter((d) => d.samples > 0);

  return (
    <section className="db-analytics" aria-label="Pipeline analytics">
      <div className="db-analytics-block">
        <h4>Stage Conversion</h4>
        <ul>
          {analytics.conversion.map((step) => (
            <li key={`${step.from_stage}-${step.to_stage}`}>
              <span className="db-analytics-step">
                {step.from_stage} → {step.to_stage}
              </span>
              <span className="db-analytics-value">
                {Math.round(step.rate * 100)}%
                <span className="db-analytics-detail">
                  {" "}
                  ({step.reached_to}/{step.reached_from})
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="db-analytics-block">
        <h4>Avg Time in Stage</h4>
        {dwellWithData.length === 0 ? (
          <p className="db-analytics-empty">
            Move jobs between stages to build velocity data.
          </p>
        ) : (
          <ul>
            {dwellWithData.map((dwell) => (
              <li key={dwell.stage}>
                <span className="db-analytics-step">{dwell.stage}</span>
                <span className="db-analytics-value">
                  {dwell.avg_days} {dwell.avg_days === 1 ? "day" : "days"}
                  <span className="db-analytics-detail">
                    {" "}
                    ({dwell.samples} {dwell.samples === 1 ? "move" : "moves"})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
