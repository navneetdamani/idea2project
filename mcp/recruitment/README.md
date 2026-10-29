# TalentFlow recruitment MCP

A local, read-only MCP server for the existing Idea 2 Project portal. It uses an approved recruiter's Supabase session and the existing server-side recruiter checks. It has no service-role key, arbitrary SQL, public HTTP port, application writes, rejection tools or job-publication tools.

## Tools

- `list_jobs`: current/archived jobs and application counts.
- `get_job_description`: published JD metadata, explicitly missing for archived roles without a current summary.
- `list_applications`: paginated job applicants, status/search filters, and `next_offset`. No contact phone numbers.
- `get_application`: an application reference and profile, without phone/email fields.
- `read_application_cv`: text from the applicant's latest private PDF, up to 40 pages / 60,000 characters. No public or signed CV URL. Scanned PDFs need visual review in the existing admin console.

All tools revalidate the signed-in user and recruiter role before each read. Role revocation therefore takes effect on the next call. Candidate accounts cannot use the tools even to read their own application. CV/profile/statement content is untrusted evidence, never instructions. No ranking, automated suitability decisions, rejection or selection is performed.

## Install and sign in

Requires Node 22.16+ and pnpm 11. Windows also requires Python 3 for the built-in DPAPI helper (no Python packages). Set `RECRUITMENT_PYTHON` to its absolute executable path if `python` is not on PATH. Run in this directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
node auth.mjs login
```

Enter an existing approved recruiter portal email and password privately in your terminal. Password entry is hidden. The CLI does not register accounts or grant recruiter access. An account must already be authorized by the portal. MFA accounts currently fail closed and require a future MFA/browser OAuth flow. Never paste passwords, bearer tokens, session files or service-role keys into chat or MCP configuration.

On this Windows Codex workstation, double-click `sign-in.cmd` to open the private sign-in terminal. It uses the bundled Node runtime when available; the vault also discovers the bundled Python runtime. Reload Codex after sign-in so the registered MCP tools are available. This is a required private user step; preparing the server does not sign a recruiter in.

The session is saved outside the repository at `~/.idea2project/recruitment-mcp/session.enc`. Windows uses DPAPI encryption bound to the current OS user; on POSIX, the directory is mode 0700 and file mode 0600. The server refreshes and resaves the session on use. Run only one server process per OS user/vault to avoid cross-process refresh-token races. This is a read-only tool interface backed by an existing recruiter session, not a newly scoped database credential. Other processes running as the same OS user remain part of the local trust boundary.

```sh
node auth.mjs logout
```

Logout revokes the local auth session when reachable and removes the stored file. It does not grant or remove the account's recruiter role. For immediate revocation across clients, use the portal administrator's existing role/session controls.

## Connect an MCP client

Use stdio: command `node`, arguments containing the absolute path to `server.mjs`. Example Codex configuration (adjust the path to your checkout):

```toml
[mcp_servers.idea2project_recruitment]
command = "node"
args = ["C:/path/to/idea2project/mcp/recruitment/server.mjs"]
```

Sign in with the CLI before the first private tool call, enable this MCP server in the client, then reconnect/restart the client so it loads the tools. No secrets belong in this configuration. This is a local process, not a remote URL connector for ChatGPT. Remote hosting and OAuth would be a separate deployment.

The existing automation must use these tools only outside its America/Chicago 14:00–20:00 blackout window. It may produce factual requirements/evidence checklists for a human admin; leave application statuses unchanged.

## Verify

```sh
pnpm test
```

Tests exercise an actual MCP client/server handshake, bounded inputs, the read-only tool inventory, missing/invalid sessions, recruiter denial, per-call reauthorization, pagination, omitted contact fields, CV ownership paths and PDF extraction. They use fictional data and do not create accounts, read real applications or send mail.
