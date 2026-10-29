import { readFile, writeFile, mkdir, unlink, rename, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// No bearer tokens in MCP configuration, browser storage, logs or the website.
export const sessionPath = join(homedir(), '.idea2project', 'recruitment-mcp', 'session.enc');
export function protect(value, decrypt = false) {
  if (process.platform !== 'win32') return value;
  return execFileSync(process.env.RECRUITMENT_PYTHON || 'python', [fileURLToPath(new URL('./dpapi.py', import.meta.url)), decrypt ? 'decrypt' : 'encrypt'], {
    input: value, encoding: 'utf8', windowsHide: true, timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe']
  });
}
export async function saveSession(session) {
  await mkdir(dirname(sessionPath), { recursive: true, mode: 0o700 });
  const temporary = join(dirname(sessionPath), '.session-' + randomUUID() + '.tmp');
  try {
    await writeFile(temporary, protect(JSON.stringify(session)), { mode: 0o600 });
    if (process.platform !== 'win32') await chmod(dirname(sessionPath), 0o700);
    await rename(temporary, sessionPath);
  } finally { await unlink(temporary).catch(() => {}); }
}
export async function loadSession() {
  try { return JSON.parse(protect(await readFile(sessionPath, 'utf8'), true)); }
  catch { throw new Error('Recruiter sign-in required. Run node auth.mjs login privately in a terminal.'); }
}
export async function clearSession() {
  await unlink(sessionPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
