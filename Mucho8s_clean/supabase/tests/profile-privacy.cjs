const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
function setup({ tokenValid = true, approved = true, dbError = false } = {}) {
  let handler; const columns = [];
  const db = { auth: { getUser: async () => ({ data: { user: tokenValid ? { id: 'account' } : null }, error: null }) },
    from() {
      const chain = { select(value) { columns.push(value); return chain; }, eq() { return chain; },
        maybeSingle: async () => ({ data: { player_id: approved ? 'player' : null }, error: dbError ? new Error('private DB details') : null }),
        not: async () => ({ data: [{ player_id: 'player', avatar_url: 'https://example.com/avatar', twitch_channel: 'channel',
          paypal_url: 'https://paypal.me/private', revolut_url: 'https://revolut.me/private' }], error: null }) };
      return chain;
    } };
  const source = fs.readFileSync(path.join(__dirname, '../functions/mucho8s-avatars/index.ts'), 'utf8').replace(/^import .*\n/gm, '');
  vm.runInNewContext(stripTypeScriptTypes(source), { Request, Response, console,
    createClient: () => db, Deno: { serve(fn) { handler = fn; }, env: { get: key => key === 'SUPABASE_SECRET_KEYS' ? '{}' : 'configured' } } });
  return { columns, request: token => handler(new Request('https://test.invalid', { headers: token ? { authorization: 'Bearer ' + token } : {} })) };
}
test('public profiles retain avatars but neither query nor disclose payment links', async () => {
  const { request, columns } = setup(); const response = await request(); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.profiles.player.paypalUrl, '');
  assert.equal(body.profiles.player.revolutUrl, ''); assert.ok(body.avatars.player);
  assert.ok(columns.every(value => !value.includes('paypal'))); assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('unapproved accounts cannot query or disclose payment links', async () => {
  const { request, columns } = setup({ approved: false }); const body = await (await request('valid')).json();
  assert.equal(body.profiles.player.paypalUrl, ''); assert.ok(columns.every(value => !value.includes('paypal')));
});
test('approved members can read payment links without public caching', async () => {
  const response = await setup().request('valid'); const body = await response.json();
  assert.equal(body.profiles.player.paypalUrl, 'https://paypal.me/private');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('forged tokens and failed permission lookups fail closed', async () => {
  assert.equal((await setup({ tokenValid: false }).request('forged')).status, 401);
  const response = await setup({ dbError: true }).request('valid'); assert.equal(response.status, 500);
  assert.ok(!(await response.text()).includes('private DB details'));
});
