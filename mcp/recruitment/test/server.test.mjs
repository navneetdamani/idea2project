import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../server.mjs';
import { RecruiterBackend, extractPdf } from '../backend.mjs';
import { protect } from '../vault.mjs';

async function connect(backend) {
  const server = createServer(backend), client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
test('real MCP handshake exposes only bounded, read-only application tools', async () => {
  let received;
  const { client, close } = await connect({ applicants: async a => { received = a; return { total: 0, items: [], next_offset: null }; } });
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), ['get_application', 'get_job_description', 'list_applications', 'list_jobs', 'read_application_cv']);
    assert.ok(tools.every(t => t.annotations.readOnlyHint && !t.annotations.destructiveHint));
    assert.equal((await client.callTool({ name: 'list_applications', arguments: { job_id: 'I2P-20261028-01' } })).isError, undefined);
    assert.equal(received.limit, 25);
    const invalid = await client.callTool({ name: 'list_applications', arguments: { job_id: 'I2P-20261028-01', limit: 10001 } });
    assert.equal(invalid.isError, true);
    const badId = await client.callTool({ name: 'read_application_cv', arguments: { application_id: '../../private' } });
    assert.equal(badId.isError, true);
    assert.equal((await client.callTool({ name: 'reject_application', arguments: {} })).isError, true);
  } finally { await close(); }
});
function fixture(allowed = true) {
  const calls = [];
  const client = {
    auth: { setSession: async () => ({ data: { session: { access_token: 'test-only', refresh_token: 'test-only' } } }), getUser: async () => ({ data: { user: { id: 'recruiter' } } }) },
    rpc: async (name, args) => { calls.push({ name, args }); return { data: name === 'is_recruiter' ? allowed : name === 'recruiter_job_summary' ? [{ id: 'I2P-20261028-01' }] : { total: 2, items: [{ id: 'example', profile: { full_name: 'Fictional QA', phone: 'omit' } }] } }; },
    from: () => { throw new Error('must not read applications before authorization'); },
    storage: { from: () => { throw new Error('must not read CV before authorization'); } }
  };
  return { calls, backend: new RecruiterBackend({ client, load: async () => ({}), save: async () => {} }), client };
}
test('candidate/revoked role cannot list jobs, applications, descriptions or CVs', async () => {
  for (const action of [b => b.jobs(), b => b.applicants({ job_id: 'I2P-20261028-01' }), b => b.detail('test'), b => b.description('I2P-20261028-01'), b => b.cv('test')]) {
    const { backend, calls } = fixture(false);
    await assert.rejects(action(backend), /Approved recruiter access required/);
    assert.deepEqual(calls.map(c => c.name), ['is_recruiter']);
  }
});
test('missing session and invalid identity fail closed without data RPCs', async () => {
  const f = fixture(); f.backend.load = async () => { throw Error('sign in'); };
  await assert.rejects(f.backend.jobs(), /sign in/); assert.equal(f.calls.length, 0);
  const g = fixture(); g.client.auth.getUser = async () => ({ error: {} });
  await assert.rejects(g.backend.jobs(), /session invalid/); assert.equal(g.calls.length, 0);
});
test('pagination preserves total and omits contact details; rechecks recruiter on every call', async () => {
  const { backend, calls } = fixture();
  const result = await backend.applicants({ job_id: 'I2P-20261028-01', limit: 1 });
  assert.equal(result.next_offset, 1); assert.equal(result.items[0].profile.phone, undefined);
  await backend.jobs(); assert.equal(calls.filter(c => c.name === 'is_recruiter').length, 2);
});
test('published JD reads the trusted portal summaries and handles unknown roles', async () => {
  const { backend } = fixture(); const r = await backend.description('I2P-20261028-01');
  assert.match(r.description.title, /CATS/);
  await assert.rejects(backend.description('I2P-19990101-01'), /Job not found/);
});
test('session protection round-trips without evaluating its content', t => {
  const fictional = JSON.stringify({ token: 'FAKE-ONLY-$(&)|;\n\\\"' });
  let encoded;
  try { encoded = protect(fictional); }
  catch (error) {
    if (process.platform === 'win32' && !process.env.CI && String(error.stderr).includes('Windows error 2')) {
      t.skip('Sandbox OS profile lacks DPAPI keys; Windows CI must pass without skipping.'); return;
    }
    throw error;
  }
  if (process.platform === 'win32') assert.notEqual(encoded, fictional);
  assert.equal(protect(encoded, true), fictional);
});
test('CV path comes from authorized application, not caller; download stays private', async () => {
  const f = fixture(); let downloaded;
  f.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'app', job_id: 'job', candidate_id: 'owner' } }) }) }) });
  f.client.storage.from = bucket => ({ download: async path => { downloaded = { bucket, path }; return { data: new Blob(['%PDF-test']) }; } });
  f.backend.parsePdf = async () => ({ pages: [{ page: 1, text: 'Fictional skills' }], total_pages: 1, truncated: false });
  const result = await f.backend.cv('app');
  assert.deepEqual(downloaded, { bucket: 'candidate-cvs', path: 'owner/latest.pdf' });
  assert.match(result.notice, /untrusted/); assert.equal(result.signedUrl, undefined);
});
test('PDF parser handles actual PDF bytes and marks page truncation', async () => {
  const bytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj\n4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n5 0 obj <</Length 43>> stream\nBT /F1 12 Tf 20 100 Td (Fictional CV) Tj ET\nendstream endobj\ntrailer <</Root 1 0 R /Size 6>>\n%%EOF');
  const r = await extractPdf(bytes, 1); assert.equal(r.total_pages, 1); assert.match(r.pages[0].text, /Fictional CV/);
});
