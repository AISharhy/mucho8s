const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { webcrypto, createHash } = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const endpoints = {
  'mucho8s-write': 'validateAdminSession', 'mucho8s-account': 'validateAdminSession',
  'mucho8s-content': 'validateAdminSession', 'mucho8s-challenges': 'isAdminRequest',
  'mucho8s-competition': 'isAdmin', 'mucho8s-discord': 'validateAdminSession',
  'mucho8s-admin-audit': 'validateAdminSession', 'mucho8s-match-reports': 'validateAdminSession',
  'mucho8s-admin-auth': 'validateSession', 'mucho8s-tourney': 'validateAdmin',
};
const base = () => ({
  admin_sessions: { username: 'admin', account_id: 'account', user_agent_hash: hash('browser'),
    expires_at: new Date(Date.now() + 60000).toISOString(), revoked_at: null },
  admin_credentials: { is_active: true, required_account_id: 'account' },
  player_accounts: { player_id: 'player' }, admin_access: { username: 'admin', is_active: true },
});
function setup(endpoint, overrides = {}, failedTable) {
  const records = { ...base(), ...overrides };
  const filters = [];
  const db = { from(table) {
    const chain = { select() { return chain; }, update() { return chain; },
      eq(key, value) { filters.push([table, key, value]); return chain; },
      maybeSingle: async () => ({ data: records[table], error: table === failedTable ? new Error('DB failure') : null }) };
    return chain;
  } };
  const source = fs.readFileSync(path.join(__dirname, '../functions', endpoint, 'index.ts'), 'utf8').replace(/^import .*\n/gm, '');
  const context = { crypto: webcrypto, TextEncoder, Request, Response, URL, URLSearchParams,
    Deno: { serve() {} }, atob, btoa, console };
  vm.runInNewContext(stripTypeScriptTypes(source) + `\nglobalThis.check = ${endpoints[endpoint]};`, context);
  return { check: (token = 'token') => context.check(new Request('https://test.invalid',
    { headers: { 'x-admin-session': token, 'user-agent': 'browser' } }), db), filters };
}
for (const endpoint of Object.keys(endpoints)) {
  test(`${endpoint}: active admin accepted; lookups bind token, account and player`, async () => {
    const { check, filters } = setup(endpoint);
    assert.ok(await check());
    for (const expected of [['admin_sessions', 'token_hash', hash('token')],
      ['player_accounts', 'id', 'account'], ['admin_access', 'player_id', 'player']])
      assert.ok(filters.some(row => JSON.stringify(row) === JSON.stringify(expected)));
  });
  test(`${endpoint}: visitor and forged sessions denied`, async () => {
    assert.ok(!await setup(endpoint).check(''));
    assert.ok(!await setup(endpoint, { admin_sessions: null }).check());
  });
  test(`${endpoint}: expired, malformed, revoked and different-browser sessions denied`, async () => {
    for (const change of [{ expires_at: 'invalid' }, { expires_at: new Date(0).toISOString() },
      { revoked_at: new Date().toISOString() }, { account_id: null }, { user_agent_hash: hash('other') }])
      assert.ok(!await setup(endpoint, { admin_sessions: { ...base().admin_sessions, ...change } }).check());
  });
  test(`${endpoint}: removed approvals, inactive credentials and revoked grants denied`, async () => {
    for (const change of [{ player_accounts: null }, { player_accounts: { player_id: null } },
      { admin_credentials: null }, { admin_credentials: { is_active: false, required_account_id: 'account' } },
      { admin_credentials: { is_active: true, required_account_id: 'other' } },
      { admin_access: null }, { admin_access: { is_active: false, username: 'admin' } },
      { admin_access: { is_active: true, username: 'other' } }])
      assert.ok(!await setup(endpoint, change).check());
  });
  test(`${endpoint}: database errors deny access`, async () => {
    for (const table of Object.keys(base())) assert.ok(!await setup(endpoint, {}, table).check());
  });
}
