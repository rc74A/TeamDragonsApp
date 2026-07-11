# Deployment pipeline (S3-017)

## The full path from merge to verified production

```
PR opened            -> lint.yml + ci.yml run (S1-006 / S1-008)
PR merged to main    -> lint.yml + ci.yml run again on the merge commit
                     -> Vercel + Render deploy main (Git integration)
CI green on main     -> deploy.yml ("CD — Deploy and Verify") runs:
                          1. confirms lint also passed for that commit
                          2. triggers deploy hooks (only if secrets set)
                          3. waits for the backend to answer 200
                          4. checks GET /version until the deployed
                             commit matches the one CI verified
                          5. checks the protected API returns 401
                          6. waits for the frontend to answer 200
```

A red **CD — Deploy and Verify** run on a `main` commit means production
is broken or stale even though CI passed — treat it like a failing test.

## How the deployed-commit check works

`GET /version` on the backend returns `{"commit": "<sha>"}` using the
`RENDER_GIT_COMMIT` env var that Render injects into every deploy. The
workflow polls it until the sha matches the commit that triggered the
run, which proves the *new* build is live rather than a stale one still
serving. Outside Render the endpoint returns `"unknown"`, which the
workflow accepts with a warning (up, but unverifiable).

The very first run after this lands may poll `/version` against a build
that predates the endpoint; it warns and keeps retrying until the new
deploy (which has it) finishes.

## Two operating modes

**Mode A — platform auto-deploy (current default).** Vercel/Render
deploy every push to `main` on their own; the workflow just verifies
the result. No setup needed. The gap: a commit that fails CI still
deploys.

**Mode B — CI-gated deploys (recommended).** Turn OFF auto-deploy in
both consoles and add the deploy-hook URLs as repo secrets; the
workflow then triggers deploys itself, only after CI is green:

1. Render → Service → Settings → Deploy Hook → copy the URL.
   GitHub → repo → Settings → Secrets and variables → Actions →
   new secret `RENDER_DEPLOY_HOOK_URL`.
2. Vercel → Project → Settings → Git → Deploy Hooks → create one for
   `main` → secret `VERCEL_DEPLOY_HOOK_URL`.
3. Render → Settings → Auto-Deploy → off. Vercel → Settings → Git →
   ignore production auto-deploys (or leave on; hook deploys are
   idempotent, you just lose the gating).

## Rollback

- **Application:** `git revert` the bad commit and merge — CI + CD run
  and the health checks verify the rollback deploy. (Faster manual
  option: on Render use Manual Deploy → "Deploy a specific commit" and
  pick the last good sha — the one-click Rollback button needs a paid
  plan; on Vercel promote the previous deployment. Either way the next
  merge re-deploys `main`, so revert the commit regardless.)
- **Database:** see the rollback plan in [Database.md](Database.md) —
  schema downgrades are guarded, data restores come from backups.

## Branch protection (one-time admin step, still pending)

GitHub → Settings → Branches → rule for `main` → require the four CI
checks (see [CI.md](CI.md)). Without it a merge can land with a red CI
run — and in that case the CD workflow is **skipped entirely** (it only
runs on a green CI conclusion), so the broken auto-deploy is never
health-checked and nothing turns red. Branch protection is what closes
that gap.

## Manually verifying production

Actions → **CD — Deploy and Verify** → Run workflow. Useful after a
console-side change (env vars, manual deploy) to confirm production is
healthy without pushing a commit. A manual dispatch is **verify-only**:
the deploy-hook steps are skipped on dispatch, so this can never
redeploy production — it only checks it. (CD also only reacts to
push-triggered CI runs on `main`, so pull requests — including fork
PRs — can never fire the deploy hooks.)
