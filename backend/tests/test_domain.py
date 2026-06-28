"""Pure unit tests for the core domain logic (S2-026).

These exercise the functions in domain.py directly — no database, no app —
so they are fast and isolate the metric/completion logic itself.
"""

from domain import compute_job_metrics, compute_profile_completion

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
    assert m["by_stage"]["Applied"] == 2
    assert m["applications"] == 4  # Applied x2 + Interviewing + Offer + Rejected
    assert m["responses"] == 3  # Interviewing + Offer + Rejected
    assert m["offers"] == 1
    assert m["response_rate"] == 0.6  # 3 / 5


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
    assert m["responses"] == 3
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
