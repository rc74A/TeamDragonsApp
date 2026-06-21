"""Pure domain logic for job-workflow metrics.

These functions take plain data and return plain data — no database, no
I/O — so they are fast and straightforward to unit-test (S2-026).
"""

# The stages a job moves through. "Saved"/"Wishlist" mean not yet applied.
STAGES = ["Saved", "Wishlist", "Applied", "Interviewing", "Offer", "Rejected"]

# A job counts as an "application" once it reaches Applied or beyond.
APPLICATION_STAGES = {"Applied", "Interviewing", "Offer", "Rejected"}

# A "response" means the employer moved you past Applied.
RESPONSE_STAGES = {"Interviewing", "Offer", "Rejected"}


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
