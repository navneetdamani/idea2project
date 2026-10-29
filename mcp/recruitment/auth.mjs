import { createClient } from '@supabase/supabase-js';
import { createInterface } from 'node:readline/promises';
import { projectUrl, publishableKey, authOptions } from './config.mjs';
import { saveSession, loadSession, clearSession } from './vault.mjs';

async function hiddenPassword() {
  if (!process.stdin.isTTY) throw new Error('Use an interactive terminal to sign in.');
  process.stderr.write('Portal password (hidden): ');
  process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { process.stdin.off('data', onData); process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write('\n'); };
    function onData(chunk) {
      for (const c of chunk.toString('utf8')) {
        if (c === '\u0003') { finish(); reject(new Error('Sign-in cancelled.')); return; }
        if (c === '\r' || c === '\n') { finish(); resolve(value); return; }
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else if (c >= ' ') value += c;
      }
    }
    process.stdin.on('data', onData);
  });
}
const client = createClient(projectUrl, publishableKey, { auth: authOptions });
try {
  if (process.argv[2] === 'login') {
    if (!process.stdin.isTTY) throw new Error('Sign in privately in an interactive terminal.');
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    const email = (await rl.question('Approved recruiter portal email: ')).trim(); rl.close();
    const password = await hiddenPassword();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error('Portal sign-in failed. Check your account and password.');
    const role = await client.rpc('is_recruiter');
    if (role.error || role.data !== true) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error('This account is not an approved recruiter. No session was saved.');
    }
    if (data.session.user.factors?.some(f => f.status === 'verified')) {
      await client.auth.signOut({ scope: 'local' });
      throw new Error('This account requires MFA. Browser/OAuth MFA support is needed before connecting; no session saved.');
    }
    await saveSession(data.session);
    console.error('Recruiter connected. Session saved privately for this OS user. No candidate status changes are exposed.');
  } else if (process.argv[2] === 'logout') {
    try {
      const s = await loadSession();
      const result = await client.auth.setSession(s);
      if (!result.error) await client.auth.signOut({ scope: 'local' });
    } finally { await clearSession(); }
    console.error('Local MCP recruiter session removed.');
  } else throw new Error('Usage: node auth.mjs login | logout');
} catch (error) { console.error(error.message); process.exitCode = 1; }
