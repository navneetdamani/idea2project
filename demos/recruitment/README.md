# TalentFlow recruitment portal

Live path: https://www.idea2proj.com/demos/recruitment/

The portal follows the Idea 2 Project cream, charcoal and orange theme. `candidate.html` provides a separate candidate account workspace for email/password registration, verification, recovery, profile editing, and latest-PDF CV upload/replacement/download/removal. It is intentionally disabled until a new Supabase project is connected. See [`supabase/SETUP.md`](../../supabase/SETUP.md) and the SQL migration for setup and access controls.

The job/JD/screening workflow demonstration still uses fictional records and browser-local storage. It provides published job cards, JD intake, explicit publication approval, screening questions, illustrative candidate rankings and recruiter review statuses. Saving changes returns a role to draft; approval is required to publish it again. Reset demo data restores the samples in this browser. It has no access to the separate candidate profiles or CVs.

Every visitor can use the admin controls. Internal notes are hidden from job cards only; there is no authentication or authorization boundary. Do not enter real names, resumes, contact details or confidential job descriptions. Demo applications accept only fictional `@example.invalid` addresses. Nothing is sent to recruiters or clients. Browser changes are not shared with other visitors or devices. If storage is blocked or full, the app displays a session-only warning.

Scores are deterministic examples based on self-reported years, implementation cycles, skill matches, notice period and answer length. They do not verify expertise, use AI, or establish hiring suitability. Human review remains necessary.

## Check locally

Run `node tests/recruitment.cjs` and `node tests/candidate.cjs` from the repository root. Serve the repository with a static HTTP server and open `/demos/recruitment/` and `/demos/recruitment/candidate.html`. The GitHub Actions Site checks workflow also verifies the migration's access policies in disposable PostgreSQL.

## Deployment and integration boundary

The existing site is hosted by GitHub Pages. Merge the reviewed recruitment change into the existing publishing branch; do not replace the root site or CNAME. This demo needs no API keys, build step, paid service or backend.

The Supabase candidate integration is implemented but not connected by default. Do not claim live registration or storage before configuration and real-project acceptance tests. A live recruiter dashboard, persistent job applications, resume processing, notifications and AI screening are separate future integrations. The demo publication checkbox models a workflow; it does not provide confidentiality enforcement.

## Current opportunities

Shared listings render from openings.js independently of browser-local demo data. Public summaries were reviewed against the 23 October 2026 emails and attached JDs: two ServiceNow HRSD positions, two UKG specialties (headcount unconfirmed), and SAP FSCM. Applications are portal-only. Job cards have no email enquiry links and display disabled application controls until a secure submission backend is connected. Closed Process Mining and incomplete calibration notices are excluded. Source emails, attachments, vendor rates and contacts are not committed. Update availability manually. Check with node tests/openings.cjs.

## Portal applications

Supabase is connected using its public project URL and publishable key. The job buttons route to candidate.html with the selected job reference. Signed-in candidates must save a profile, upload a private latest CV, enter availability and relevant experience, and consent before applying. Applications have server-generated references and appear in My applications. Database policies enforce ownership, an open job and an existing profile/CV; duplicate submissions are rejected. Current profile and CV updates apply to existing applications; profile deletion also removes its applications. Authorized project administrators review applications in Supabase; the separate recruiter workflow screen remains a fictional demo. Email registration remains a limited pilot until production SMTP and actual verification delivery are tested. Apply both tracked migrations for a new installation. Run node tests/applications.cjs and the application policy SQL tests in addition to the existing checks.
