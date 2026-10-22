# TalentFlow recruitment MVP demo

Live path: https://www.idea2proj.com/demos/recruitment/

This self-contained static demonstration uses fictional records and browser-local storage. It provides published job cards, JD intake, explicit publication approval, screening questions, illustrative candidate rankings and recruiter review statuses. Saving changes returns a role to draft; approval is required to publish it again. Reset demo data restores the samples in this browser.

Every visitor can use the admin controls. Internal notes are hidden from job cards only; there is no authentication or authorization boundary. Do not enter real names, resumes, contact details or confidential job descriptions. Demo applications accept only fictional `@example.invalid` addresses. Nothing is sent to recruiters or clients. Browser changes are not shared with other visitors or devices. If storage is blocked or full, the app displays a session-only warning.

Scores are deterministic examples based on self-reported years, implementation cycles, skill matches, notice period and answer length. They do not verify expertise, use AI, or establish hiring suitability. Human review remains necessary.

## Check locally

Run `node tests/recruitment.cjs` from the repository root. Serve the repository with a static HTTP server and open `/demos/recruitment/`. The GitHub Actions Site checks workflow runs the same regression checks.

## Deployment and integration boundary

The existing site is hosted by GitHub Pages. Merge the reviewed recruitment change into the existing publishing branch; do not replace the root site or CNAME. This demo needs no API keys, build step, paid service or backend.

Production operation would require a separately reviewed backend with authentication, recruiter/client access controls, a database, secure resume storage, retention/deletion controls, consent records, email delivery and audited integration with any screening or AI provider. These integrations are not implemented in this prototype. The publication checkbox models a workflow; it does not provide confidentiality enforcement.
