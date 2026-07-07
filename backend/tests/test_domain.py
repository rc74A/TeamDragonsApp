"""Pure unit tests for the core domain logic (S2-026).

These exercise the functions in domain.py directly — no database, no app —
so they are fast and isolate the metric/completion logic itself.
"""

from datetime import datetime

from domain import (
    compute_job_metrics,
    compute_profile_completion,
    compute_stage_analytics,
)

# ----- Job metrics (stage counts + response tracking) -----


def test_metrics_empty():
    """No jobs yields zeroed metrics."""
    m = compute_job_metrics([])
    assert m["total"] == 0
    assert m["applications"] == 0
    assert m["responses"] == 0
    assert m["offers"] == 0
    assert m["response_rate"] == 0.0
    assert all(count == 0 for count in m["by_stage"].values())


def test_metrics_counts_each_stage_and_rate():
    """Per-stage counts, applications, responses, and rate are correct."""
    m = compute_job_metrics(
        ["Interested", "Applied", "Interview", "Offer", "Rejected", "Archived"]
    )
    assert m["total"] == 6
    assert m["by_stage"]["Applied"] == 1
    assert m["applications"] == 5  # Applied x2 + Interviewing + Offer + Rejected
    assert m["responses"] == 4  # Interviewing + Offer + Rejected
    assert m["offers"] == 1
    assert m["response_rate"] == 0.8  # 3 / 5


def test_metrics_no_applications_avoids_divide_by_zero():
    """Pre-application stages give a 0.0 response rate, not an error."""
    m = compute_job_metrics(["Saved", "Wishlist", "Wishlist"])
    assert m["applications"] == 0
    assert m["responses"] == 0
    assert m["response_rate"] == 0.0


def test_metrics_full_response_rate():
    """Every application getting a response yields a rate of 1.0."""
    m = compute_job_metrics(["Offer", "Interviewing", "Rejected"])
    assert m["applications"] == 2
    assert m["responses"] == 2
    assert m["response_rate"] == 1.0


# ----- Profile completion -----


def test_completion_empty_profile():
    """An empty profile is 0% complete."""
    assert compute_profile_completion({}) == {"filled": 0, "total": 5, "percent": 0}


def test_completion_partial_profile():
    """A partially filled profile reports the right fraction."""
    c = compute_profile_completion({"full_name": "Joel", "email": "j@x.com"})
    assert c["filled"] == 2
    assert c["total"] == 5
    assert c["percent"] == 40  # 2 / 5


def test_completion_full_profile():
    """A fully filled profile is 100% complete."""
    c = compute_profile_completion(
        {
            "full_name": "Joel",
            "email": "j@x.com",
            "phone": "5550100",
            "location": "Newark",
            "summary": "Engineer",
        }
    )
    assert c == {"filled": 5, "total": 5, "percent": 100}


def test_completion_ignores_whitespace_only():
    """Whitespace-only values do not count toward completion."""
    c = compute_profile_completion({"full_name": "   ", "email": "j@x.com"})
    assert c["filled"] == 1  # whitespace-only full_name does not count


# ----- Stage analytics: conversion + time in stage (S3-014) -----


def _job(job_id, stage, created=None):
    """Build a job dict for analytics tests."""
    return {"id": job_id, "stage": stage, "created_at": created}


def _event(job_id, old, new, at):
    """Build a stage-history event dict for analytics tests."""
    return {"job_id": job_id, "old_stage": old, "new_stage": new, "changed_at": at}


def test_analytics_empty():
    """No jobs yields zeroed funnel, conversion, and dwell times."""
    a = compute_stage_analytics([], [])
    assert all(count == 0 for count in a["funnel"].values())
    assert [c["rate"] for c in a["conversion"]] == [0.0, 0.0, 0.0]
    assert all(d["samples"] == 0 and d["avg_days"] == 0.0 for d in a["time_in_stage"])


def test_analytics_funnel_counts_stages_ever_reached():
    """A job counts once for every stage it has ever been in (S3-BR-013)."""
    events = [
        _event(1, "Interested", "Applied", datetime(2026, 7, 1)),
        _event(1, "Applied", "Interview", datetime(2026, 7, 3)),
    ]
    a = compute_stage_analytics([_job(1, "Interview"), _job(2, "Interested")], events)
    assert a["funnel"]["Interested"] == 2
    assert a["funnel"]["Applied"] == 1
    assert a["funnel"]["Interview"] == 1
    assert a["funnel"]["Offer"] == 0


def test_analytics_conversion_rates():
    """Conversion is reached[to] / reached[from] along the funnel path."""
    events = [
        _event(1, "Interested", "Applied", datetime(2026, 7, 1)),
        _event(2, "Interested", "Applied", datetime(2026, 7, 1)),
        _event(1, "Applied", "Interview", datetime(2026, 7, 5)),
    ]
    jobs = [
        _job(1, "Interview"),
        _job(2, "Applied"),
        _job(3, "Interested"),
        _job(4, "Interested"),
    ]
    a = compute_stage_analytics(jobs, events)
    steps = {(c["from_stage"], c["to_stage"]): c for c in a["conversion"]}
    # 4 reached Interested, 2 reached Applied, 1 reached Interview.
    assert steps[("Interested", "Applied")]["rate"] == 0.5
    assert steps[("Applied", "Interview")]["rate"] == 0.5
    assert steps[("Interview", "Offer")]["rate"] == 0.0


def test_analytics_time_in_stage_uses_completed_intervals():
    """Dwell time averages creation->first and event->event gaps (S3-BR-014)."""
    events = [
        _event(1, "Interested", "Applied", datetime(2026, 7, 3)),
        _event(1, "Applied", "Interview", datetime(2026, 7, 7)),
    ]
    a = compute_stage_analytics([_job(1, "Interview", datetime(2026, 7, 1))], events)
    dwell = {d["stage"]: d for d in a["time_in_stage"]}
    assert dwell["Interested"] == {"stage": "Interested", "avg_days": 2.0, "samples": 1}
    assert dwell["Applied"] == {"stage": "Applied", "avg_days": 4.0, "samples": 1}
    # Still sitting in Interview: no completed interval, no sample.
    assert dwell["Interview"]["samples"] == 0


def test_analytics_ignores_outcome_pseudo_stages():
    """History rows like 'Outcome: Accepted' are not stage transitions."""
    events = [
        _event(1, "Interested", "Applied", datetime(2026, 7, 2)),
        _event(1, "Applied", "Outcome: Accepted", datetime(2026, 7, 4)),
    ]
    a = compute_stage_analytics([_job(1, "Applied", datetime(2026, 7, 1))], events)
    assert a["funnel"]["Applied"] == 1
    assert "Outcome: Accepted" not in a["funnel"]
    # The outcome row contributes no dwell sample for Applied either.
    assert {d["stage"]: d["samples"] for d in a["time_in_stage"]}["Applied"] == 0


def test_analytics_sorts_events_and_skips_missing_created_at():
    """Out-of-order events are sorted into a timeline; no created_at means
    no creation interval. Pinned exactly so the mechanism can't regress.
    """
    events = [
        _event(1, "Interested", "Applied", datetime(2026, 7, 5)),
        _event(1, "Applied", "Interview", datetime(2026, 7, 2)),  # out of order
    ]
    a = compute_stage_analytics([_job(1, "Interview", None)], events)
    dwell = {d["stage"]: d for d in a["time_in_stage"]}
    # Sorted timeline: (Applied->Interview 7/2) then (Interested->Applied 7/5),
    # so the one completed interval is 3 days spent in Interview.
    assert dwell["Interview"] == {"stage": "Interview", "avg_days": 3.0, "samples": 1}
    assert dwell["Interested"]["samples"] == 0
    assert dwell["Applied"]["samples"] == 0


def test_analytics_skips_creation_interval_when_created_after_first_event():
    """A created_at later than the first event (backfilled/imported data)
    contributes no dwell sample instead of a negative one.
    """
    events = [_event(1, "Interested", "Applied", datetime(2026, 7, 5))]
    a = compute_stage_analytics([_job(1, "Applied", datetime(2026, 7, 10))], events)
    dwell = {d["stage"]: d for d in a["time_in_stage"]}
    assert dwell["Interested"] == {"stage": "Interested", "avg_days": 0.0, "samples": 0}
    assert all(d["avg_days"] >= 0.0 for d in a["time_in_stage"])


def test_analytics_skipped_stage_keeps_conversion_within_bounds():
    """A move that skips a funnel stage counts the skipped stage as passed,
    so conversion can never exceed 100% (S3-BR-013).
    """
    events = [
        _event(1, "Interested", "Interview", datetime(2026, 7, 2)),  # skips Applied
        _event(2, "Interested", "Interview", datetime(2026, 7, 2)),
        _event(3, "Interested", "Applied", datetime(2026, 7, 2)),
    ]
    jobs = [_job(1, "Interview"), _job(2, "Interview"), _job(3, "Applied")]
    a = compute_stage_analytics(jobs, events)
    assert a["funnel"]["Applied"] == 3  # includes the two that skipped past it
    steps = {(c["from_stage"], c["to_stage"]): c for c in a["conversion"]}
    assert steps[("Interested", "Applied")]["rate"] == 1.0
    assert steps[("Applied", "Interview")]["rate"] == 0.67
    assert all(c["rate"] <= 1.0 for c in a["conversion"])


def test_analytics_revisited_stage_pools_dwell_and_counts_once():
    """Moving back into a stage pools its dwell samples but the funnel
    still counts the job once per stage.
    """
    events = [
        _event(1, "Interested", "Applied", datetime(2026, 7, 1)),
        _event(1, "Applied", "Interview", datetime(2026, 7, 3)),
        _event(1, "Interview", "Applied", datetime(2026, 7, 4)),
        _event(1, "Applied", "Interview", datetime(2026, 7, 8)),
    ]
    a = compute_stage_analytics([_job(1, "Interview", None)], events)
    assert a["funnel"]["Applied"] == 1
    assert a["funnel"]["Interview"] == 1
    dwell = {d["stage"]: d for d in a["time_in_stage"]}
    # Applied was occupied 7/1-7/3 (2d) and 7/4-7/8 (4d): pooled avg 3.0.
    assert dwell["Applied"] == {"stage": "Applied", "avg_days": 3.0, "samples": 2}
    assert dwell["Interview"]["samples"] == 1
