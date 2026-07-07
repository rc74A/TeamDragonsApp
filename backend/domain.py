"""Pure domain logic for job-workflow metrics.

These functions take plain data and return plain data — no database, no
I/O — so they are fast and straightforward to unit-test (S2-026).
"""

# The stages a job moves through. Names have been updated from a previous version.
STAGES = ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"]

# A job counts as an "application" once it reaches Applied or beyond.
APPLICATION_STAGES = {"Applied", "Interview", "Offer", "Rejected", "Archived"}

# A "response" means the employer moved you past Applied.
RESPONSE_STAGES = {"Interview", "Offer", "Rejected", "Archived"}

# Baseline profile fields that count toward completion (S1-BR-009).
PROFILE_FIELDS = ["full_name", "email", "phone", "location", "summary"]


def compute_job_metrics(stages: list[str]) -> dict:
    """
    Compute dashboard metrics from a list of job stage values (S2-025).

    Args:
        stages (list[str]): The stage of each job owned by a user.

    Returns:
        dict: total job count, by_stage (count per known stage),
            applications, responses, offers, and response_rate
            (responses / applications, 0.0 when there are no applications).
    """
    by_stage: dict[str, int] = dict.fromkeys(STAGES, 0)
    applications = 0
    responses = 0
    offers = 0

    for stage in stages:
        by_stage[stage] = by_stage.get(stage, 0) + 1
        if stage in APPLICATION_STAGES:
            applications += 1
        if stage in RESPONSE_STAGES:
            responses += 1
        if stage == "Offer":
            offers += 1

    response_rate = round(responses / applications, 2) if applications else 0.0

    return {
        "total": len(stages),
        "by_stage": by_stage,
        "applications": applications,
        "responses": responses,
        "offers": offers,
        "response_rate": response_rate,
    }


# The forward path a job takes through the funnel. Rejected/Archived are
# terminal outcomes, not funnel steps, so conversion is only measured
# along this path (S3-014).
FUNNEL_PATH = ["Interested", "Applied", "Interview", "Offer"]


def compute_stage_analytics(jobs: list[dict], events: list[dict]) -> dict:
    """
    Compute conversion and time-in-stage analytics from stage events (S3-014).

    Only real stage transitions count: history rows whose stages are not
    in STAGES (e.g. the "Outcome: ..." pseudo-stages logged for outcome
    changes) are ignored. Time in stage uses completed intervals only —
    a job still sitting in a stage contributes no dwell sample for it.

    Args:
        jobs (list[dict]): One dict per job: id, stage (current), and
            created_at (datetime or None).
        events (list[dict]): One dict per history row: job_id, old_stage,
            new_stage, and changed_at (datetime).

    Returns:
        dict: funnel (jobs that ever reached each stage), conversion
            (rate between consecutive funnel stages), and time_in_stage
            (avg_days and samples per stage, in STAGES order).
    """
    known = set(STAGES)
    valid_events = [
        e
        for e in events
        if e["old_stage"] in known and e["new_stage"] in known and e["changed_at"]
    ]

    events_by_job: dict = {}
    for event in valid_events:
        events_by_job.setdefault(event["job_id"], []).append(event)

    # --- Funnel: how many jobs ever reached each stage ---
    reached = dict.fromkeys(STAGES, 0)
    for job in jobs:
        seen = set()
        if job["stage"] in known:
            seen.add(job["stage"])
        for event in events_by_job.get(job["id"], []):
            seen.add(event["old_stage"])
            seen.add(event["new_stage"])
        for stage in seen:
            reached[stage] += 1

    # --- Conversion between consecutive funnel stages ---
    conversion = []
    for from_stage, to_stage in zip(FUNNEL_PATH, FUNNEL_PATH[1:], strict=False):
        reached_from = reached[from_stage]
        reached_to = reached[to_stage]
        rate = round(reached_to / reached_from, 2) if reached_from else 0.0
        conversion.append(
            {
                "from_stage": from_stage,
                "to_stage": to_stage,
                "reached_from": reached_from,
                "reached_to": reached_to,
                "rate": rate,
            }
        )

    # --- Time in stage: completed intervals from the event timeline ---
    total_seconds = dict.fromkeys(STAGES, 0.0)
    samples = dict.fromkeys(STAGES, 0)
    for job in jobs:
        timeline = sorted(
            events_by_job.get(job["id"], []), key=lambda e: e["changed_at"]
        )
        if not timeline:
            continue
        # The stretch from creation to the first transition, when datable.
        first = timeline[0]
        if job.get("created_at") and job["created_at"] <= first["changed_at"]:
            seconds = (first["changed_at"] - job["created_at"]).total_seconds()
            total_seconds[first["old_stage"]] += seconds
            samples[first["old_stage"]] += 1
        # Each stretch between consecutive transitions.
        for prev, curr in zip(timeline, timeline[1:], strict=False):
            if prev["changed_at"] <= curr["changed_at"]:
                seconds = (curr["changed_at"] - prev["changed_at"]).total_seconds()
                total_seconds[prev["new_stage"]] += seconds
                samples[prev["new_stage"]] += 1

    time_in_stage = [
        {
            "stage": stage,
            "avg_days": round(total_seconds[stage] / samples[stage] / 86400, 1)
            if samples[stage]
            else 0.0,
            "samples": samples[stage],
        }
        for stage in STAGES
    ]

    return {
        "funnel": reached,
        "conversion": conversion,
        "time_in_stage": time_in_stage,
    }


def compute_profile_completion(values: dict) -> dict:
    """
    Compute how complete a profile is from its baseline field values.

    A field counts as filled only if it has non-whitespace content, so a
    profile of all blanks is 0% complete (S1-BR-011 / S2-025 tie-in).

    Args:
        values (dict): Maps each baseline field name to its string value.

    Returns:
        dict: filled (count), total (count), and percent (0-100, rounded).
    """
    total = len(PROFILE_FIELDS)
    filled = sum(1 for field in PROFILE_FIELDS if str(values.get(field, "")).strip())
    percent = round(filled / total * 100) if total else 0
    return {"filled": filled, "total": total, "percent": percent}
