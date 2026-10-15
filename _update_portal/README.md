# Idea 2 Project website update portal

Private request portal for `navneetdamani/idea2project`, separate from the public GitHub Pages website. This service uses a tool-less OpenAI coding step to propose complete file edits. The model cannot execute commands, browse URLs, access credentials, call GitHub, merge, or change its policy. Trusted application code validates each edit, creates the branch and pull request, verifies checks, and merges through GitHub's protected-branch API.

## Supported automatic changes

Visible text in the five existing root HTML pages, plus styling in `style.css`. HTML structure, all attributes (including links), scripts, inline styles, comments, demo sites, assets, and all infrastructure files are protected. CSS parsing rejects new/changed network resources, escapes, unsafe functions and unparsed syntax. Unsupported requests fail closed. New pages, links, scripts, assets, and broader application changes need a separately reviewed developer PR.

The policy reduces prompt-injection authority through fixed tools and edit permissions. It is not a claim that an AI can recognize every malicious instruction or guarantee editorial quality. Authorized editors can change public copy and styling. All allowed files and request text are sent to the configured OpenAI API project; no credentials or private request history are sent. `store:false` is set; the API account's applicable data-retention terms still apply.

## Deployment proposal

`render.yaml` provisions one Docker web service with 512 MB RAM and a 1 GB persistent disk. The public site stays on its existing GitHub Pages deployment. Use the assigned HTTPS Render URL initially; a custom portal subdomain is optional and needs DNS access. Confirm the current Render bill before creating the service. Render's published rates at preparation time were $7/month for this compute plan and $0.25/month for the disk, plus any bandwidth/build/workspace charges. OpenAI inference is separately metered.

The portal starts with `AUTO_PUBLISH=false`. Portal service redeploys are manual; website content merges still trigger existing Pages publishing. The database, sessions, queue, quotas and audit history live under `/var/data`. **Run exactly one instance against one persistent disk.** Multiple independent processes are unsupported. This is a small-team deployment with downtime during service restarts; managed Postgres and a queue lease are needed before scaling out.

## Account setup and essential permissions

1. Approve the service cost, initial editor allowlist, and automatic publishing scope before deployment or merging this implementation.
2. Create a GitHub OAuth App. Homepage: the portal HTTPS origin. Callback: `https://YOUR-PORTAL/auth/callback`. The app requests only `user:email`, never repository scope. Enter its client ID and secret only in Render secret settings. Editors sign in using a GitHub account containing an **exact, verified** allowlisted email address. No Gmail password or inbox access is required.
3. Create a dedicated GitHub App and install it on **only `navneetdamani/idea2project`**. Repository permissions: Contents **read/write**, Pull requests **read/write**, Checks **read**, Actions **read**, Administration **read**, and implicit Metadata **read**. No organization, account, workflows-write, administration-write, secrets or deployments permissions. Webhooks are unnecessary. Keep it out of all branch-rule bypass lists. The server signs short-lived installation tokens restricted again to repository ID `1161431573` and these permissions. Never use a personal access token.
4. Enter the GitHub App ID, installation ID and RSA private key as Render secrets. Newlines may be real or escaped `\n`. Installations cannot narrow Contents permission to paths; the application edit validator is the path boundary. Keep its code and deployment trusted and reviewed.
5. Create a restricted OpenAI project service-account API key with access to Responses inference and the chosen model only; configure the project budget/alerts and model limits in the platform. Enter `OPENAI_API_KEY` and an available structured-output-capable `OPENAI_MODEL` as Render secrets. Do not enter secrets into Git, this chat, requests, screenshots, logs, or workflow files. The app imposes five requests per editor per hour and twenty requests globally per rolling daily window, with one inference call per request and an output token cap; provider budgets and pricing must be configured separately.
6. Set `PORTAL_ORIGIN` to the exact HTTPS origin with no trailing slash; `ALLOWED_EMAILS` to the approved comma-separated email list. The initial administrator is repository owner GitHub ID `258078742`. Review that identity before deployment; administrator changes require reviewed source/config changes. Removing an allowlisted email invalidates its sessions on the next request after config takes effect. Sessions expire after eight hours. To revoke all sessions immediately, delete their rows using a trusted service shell.
7. Deploy the approved commit with the Render Blueprint. Confirm the attached disk is writable by container user `node` (UID 1000) and is persistent across restarts. Confirm OAuth login and health endpoint before allowing requests. Only the data directory needs write permission; app/source files should remain read-only in production.

## Required protected-branch setup

After this workflow is on main and has run, configure **classic branch protection** for `main`:

- Require pull requests before merging. Set required approving reviews to zero for this automation, or use a separate review workflow and accept that automatic merges wait for it.
- Require status check **`site-checks`**, explicitly from the **GitHub Actions** app (ID `15368`). Require branches to be up to date before merging.
- Enforce rules for administrators; do not grant the portal app bypass permission. Disable force pushes and branch deletion. Restrict direct pushes if the repository plan supports it.
- Keep the existing Pages source at `main` / root and ensure squash merging is allowed. GitHub's native auto-merge setting can remain off: this service explicitly calls the merge API only after its gate passes.

The server reads branch protection through the app's read-only Administration permission and refuses automatic merging if strict required checks, the expected check source or administrator enforcement are absent. Rulesets alone do not satisfy this implementation's classic-protection verification. The current chat GitHub connector could not read the repository's protection settings; they are **unverified** until an administrator configures them and the deployed app confirms them.

Each merge gate checks the expected PR, branch, repository, main branch SHA, head SHA, check-run app identity, workflow path and event, run SHA, successful conclusions, and mergeability. The merge API supplies the checked head SHA; strict GitHub protection closes concurrent-base-change races. Missing, pending, skipped, cancelled, failed, ambiguous or untrusted checks never count as success. Changes to main while a request is pending cause a safe failure and require resubmission.

## Verification before enabling publishing

Use `pnpm@11.25.0 install --frozen-lockfile --ignore-scripts`, then `node --test test/*.test.mjs` and `node check-site.mjs` from this directory on Node 24.19.0. CI uses pinned action commits, read-only repository access and no secrets. Automated website PRs additionally compare every changed file against their base under the edit policy.

Before setting `AUTO_PUBLISH=true`, test on a non-production repository with its own installation and adjusted hard-coded repository/identity constants:

1. Authorized verified-email login succeeds; other accounts and unverified emails fail. Confirm OAuth callback and session cookies on real HTTPS.
2. A harmless copy request produces the expected branch/PR; public PR title/body contain only the opaque request ID. Confirm rejected HTML/script/workflow edits never publish.
3. Failed or pending CI, missing protection, changed PR head and stale main prevent merging. Re-run the genuine CI check to test recovery.
4. Enable automatic publishing only after approval, then test a harmless update end to end through CI, merge and Pages. Deployment status currently means successful GitHub Pages workflow completion; it does not guarantee website correctness or independently verify DNS/CDN propagation. Review the actual site.
5. Exercise administrator pause, restart persistence and latest-update rollback. Verify the public site returns to the prior content and the portal stays paused afterwards.

Local tests use mocked GitHub/OpenAI responses and a real temporary HTTP server/SQLite database. They do not substitute for actual OAuth, Docker/Render, branch protection, live inference, GitHub Actions or Pages acceptance testing. No production credentials or external API calls are needed to run them.

## Pause, rollback and recovery

The administrator can pause merges or request rollback from history. Rollback is permitted only when `main` is still exactly the recorded merged commit, and no other change is active. It creates a new PR restoring the previous tree, runs the same checks, and goes through the protected merge gate. It never force-pushes or resets main. New normal requests stay paused until an administrator resumes publishing. Rollback still needs `AUTO_PUBLISH=true`; if disabled, it waits for approved activation or a manual reviewed merge.

A failed/timed-out Pages workflow pauses publishing and marks the deployment failed. The administrator must explicitly request rollback; automatic rollback on a transient deployment failure is intentionally not enabled. If main has advanced, a developer must prepare a targeted revert and check it rather than overwrite newer work. If Pages itself is unavailable, a revert cannot restore the serving layer until Pages recovers.

The worker reconciles an uncertain merge from PR state before further merging. Interrupted planning fails safely and may leave an orphan branch/PR for administrator review. Do not resubmit blindly after a crash: inspect history and GitHub first. Checks time out after one hour and deployments after thirty minutes. API failures fail closed; no retries bypass policy.

## Audit, backups and operations

Audit events are append-only through SQLite triggers and hash-linked, with integrity verification on startup. The administrator can export the most recent 500 events; this export is a convenience view, not a complete archival backup. Archive full database backups and externally store the latest audit hash to detect truncation. Someone with database/filesystem administrator access can replace the database and hash chain; this is not externally immutable storage.

Requests contain private text at rest on the host's encrypted disk; filesystem and Render account access remain sensitive. Session tokens are hashed; OAuth tokens are not persisted. Logs omit request bodies, credentials, OAuth codes and upstream error bodies. Keep dashboard/request-URL access restricted because OAuth authorization codes can appear in provider access logs. Rotate app keys, OAuth secrets and API keys after suspected exposure.

Use Node's SQLite online backup API or stop the process and copy the database together with its WAL state to a private encrypted backup destination. Test restoration before production and after schema changes. Render disk snapshots alone are not a verified SQLite backup strategy. Back up before upgrades. On restore, revoke old sessions/OAuth state, verify the audit chain and compare all active requests with GitHub before resuming. No backup target or external audit archive is provisioned by the Blueprint; the owner must choose one before production activation.

Dependencies and Docker base image versions are pinned by package lock or version tag; schedule reviewed security updates. The Docker base tag is not digest-pinned, and a production container build plus hosted smoke test are still required before publishing. There is no external alerting integration yet: the dashboard records failures and pauses, so an operator must monitor it. No notifications are sent to editors automatically.

## Reference documentation

- [GitHub OAuth authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub App installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI agent credential boundaries](https://developers.openai.com/api/docs/guides/agents-api/environments/security)
- [Render Blueprint reference](https://render.com/docs/blueprint-spec), [persistent disks](https://render.com/docs/disks), [pricing](https://render.com/pricing)
