# TalentFlow: new Supabase project setup

The website remains on GitHub Pages. Supabase provides email/password authentication, a PostgreSQL candidate-profile database, and a private CV storage bucket. No additional web server is needed for these candidate features.

The checked-in `applications/recruitment/config.js` is intentionally empty. Candidate registration, profile saving, and uploads stay unavailable until this setup is complete. The JD/screening/ranking workflow remains a separate fictional browser-local demonstration; it does not read candidate accounts or CVs.

## 1. Create the project

In the [Supabase dashboard](https://supabase.com/dashboard), create a project in the owner's organization. Choose the region for candidate data and a plan after reviewing current quotas, costs, and backup needs. Keep the database password and all secret/service-role keys private. Project creation and billing decisions must be made in the owner's account.

## 2. Apply the database migration

Open the project's SQL Editor and run the complete contents of `supabase/migrations/202610220001_candidate_portal.sql` once. Use a new project: the migration deliberately fails on conflicting existing tables or bucket names instead of quietly reusing an unknown configuration. It runs in a transaction.

This creates:

- `candidate_profiles`, keyed by the authenticated user's UUID, with profile details and a consent record. Email and passwords are handled by Supabase Auth; application code does not store passwords.
- A private `candidate-cvs` bucket, restricted to PDF files of at most 5 MB. The only candidate-writable object key is `<user UUID>/latest.pdf`; uploading a newer CV replaces it.
- `recruiters`, an administrator-managed allowlist. Candidates cannot read or edit the allowlist or grant themselves recruiter rights.
- Row-level access policies: candidates can read/change/remove their own profiles and CVs; allowlisted recruiters can read them; anonymous visitors cannot access them. Recruiters cannot edit another person's self-reported profile.

Do not make the bucket public or disable row-level security.

## 3. Configure authentication and email

Enable email/password sign-up, keep email confirmation enabled, and set the minimum password length to 12. Set the Site URL to:

`https://www.idea2proj.com/applications/recruitment/candidate.html`

Add this exact URL to the allowed redirect URLs. Both verification and password recovery return there. For local testing only, optionally add `http://127.0.0.1:8765/applications/recruitment/candidate.html` and remove it when finished.

Configure a production SMTP provider and an authenticated sender domain before inviting candidates. Supabase's default email sender is restricted and is not suitable for a public recruiting launch. Test verification and password-reset delivery to a non-team test address. Review sign-up rate limits and enable bot protection before public promotion; if CAPTCHA is enabled, connect its widget before accepting registrations.

## 4. Connect the public website

From the project's API/connect settings, copy the project URL and **publishable key**. The supported URL format is `https://<project-ref>.supabase.co`.

Update only these public values in `applications/recruitment/config.js`:

```js
window.TALENTFLOW_CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabasePublishableKey: 'YOUR-PUBLIC-PUBLISHABLE-KEY'
});
```

The URL and publishable key are designed for browser use; access protection comes from authentication and database/storage policies. Never put a service-role key, secret key, database connection string, database password, or SMTP credential in the repository or browser configuration. The client also rejects known secret/service-role key formats.

Deploy the configuration through a reviewed PR to `main`, wait for Site checks and GitHub Pages deployment, then verify the candidate page. Until then, its public form displays a connection-pending notice and accepts no submissions.

## 5. Grant recruiter access

A trusted administrator can add an existing verified user's UUID in SQL Editor:

```sql
insert into public.recruiters (user_id)
values ('REPLACE-WITH-VERIFIED-RECRUITER-USER-UUID');
```

Revoke access by deleting that UUID from the allowlist. Never use editable user metadata as a source of recruiter privileges. The current public admin/ranking screen is still a sample-data demo; a live recruiter dashboard is not implemented. For now, authorized project administrators can inspect candidate profiles and private files in the Supabase dashboard. API read permissions are ready for a later authenticated recruiter console.

## 6. Run the acceptance checks with fictional test accounts

1. Register candidates A and B, verify both emails, and test sign-in, sign-out and password recovery. Verify confirmation redirects and error messages.
2. As A, save a profile, upload a small valid PDF, download it, replace it with another PDF, and confirm only the latest file remains. Invalid extensions, PDF headers and files above 5 MB must be rejected by the UI; MIME and size must also be enforced by the Storage API.
3. Use B's access token to attempt direct API reads and writes of A's profile and CV, including overwrite and deletion. All must be denied or return zero rows. Changing IDs in browser code must not grant access.
4. An unauthenticated request using the publishable key must not read any profiles or CVs. A direct public-storage URL must not serve a CV. An allowlisted recruiter should be able to read the records but not change candidate-owned profile data.
5. Remove A's profile and CV and verify they disappear. Its login account remains. When closing an account as an administrator, remove Storage objects through the Storage API before deleting the Auth user. Do not delete rows directly from Storage's internal tables.
6. Confirm real account/profile data never appears in the browser-local demo's candidate ranking or localStorage. The SDK uses sessionStorage for authentication tokens; profile content and CV bytes are not stored there by application code. Use sign-out on shared devices.

Automated checks: `node tests/recruitment.cjs` and `node tests/candidate.cjs`. The latter uses a mock Supabase adapter and does not prove a real project's configuration. GitHub CI additionally runs the SQL migration and isolation tests in disposable PostgreSQL with minimal Auth/Storage schema fixtures; real Storage service behavior and email delivery still require the acceptance checks above.

## Operations before real candidate intake

Confirm the organization's privacy notice, data location, retention period, access/deletion process, backup coverage and named recruiter owners. Publish the approved privacy notice in the candidate flow before inviting real candidates. CV extension/header checks and Storage MIME limits are not malware scanning: add a server-side scanning/quarantine step before processing uploaded CVs with external tools. This release does not parse resumes, call AI providers, email recruiters, submit to clients or persist real job applications. Those are separate integrations and must not be inferred from the demo.

## References

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Password authentication and production email](https://supabase.com/docs/guides/auth/passwords)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Storage file limits](https://supabase.com/docs/guides/storage/buckets/creating-buckets)
- [PostgreSQL row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

The vendored browser client is `@supabase/supabase-js` 2.118.0, taken from the official npm package with its SHA-512 registry integrity verified. Its license is in `applications/recruitment/vendor/SUPABASE-LICENSE`. Review and test dependency updates before replacing the pinned file.
