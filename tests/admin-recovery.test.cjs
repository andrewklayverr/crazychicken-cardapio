/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomBytes } = require('node:crypto');
// Compile only local TypeScript modules; no app server, env files or real DB.
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { recoverOwner, recoveryConfig, recoveryOrigin, takeAdminAttempt } = require('../lib/admin-recovery.ts');
const { hashPassword, verifyPassword, hashToken } = require('../lib/admin-security.ts');
const email = 'owner@example.com';
const password = 'new-password-for-test-only';
function config() { return { ADMIN_RECOVERY_EMAIL: email, ADMIN_RECOVERY_CODE: randomBytes(32).toString('base64url'), ADMIN_RECOVERY_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString() }; }
function body(env) { return { email, code: env.ADMIN_RECOVERY_CODE, password, confirmPassword: password }; }

// A deliberately serialized transaction adapter. Tests verify service semantics,
// not the behavior of a real MySQL lock manager.
function database(overrides = {}) {
  let state = { user: { id: 7, email, role: 'owner', status: 'active', passwordHash: 'old', failedLoginCount: 4, lockedUntil: 'future', mfa: 'preserve-me' }, tokens: [], revoked: false, audit: [], throttles: {}, ...overrides };
  let queue = Promise.resolve();
  let failAudit = false;
  return {
    get state() { return state; },
    set failAudit(value) { failAudit = value; },
    async getConnection() {
      let local, unlock;
      return {
        async beginTransaction() { const previous = queue; queue = new Promise(resolve => { unlock = resolve; }); await previous; local = structuredClone(state); },
        async commit() { state = local; },
        async rollback() {},
        release() { unlock(); },
        async execute(sql, args = []) {
          if (sql.startsWith('INSERT INTO admin_login_throttles')) local.throttles[args[0]] ??= { attempts: 0, recent: 1 };
          else if (sql.startsWith('SELECT attempts')) return [[local.throttles[args[0]]]];
          else if (sql.startsWith('UPDATE admin_login_throttles')) local.throttles[args[2]] = { attempts: args[0], recent: 1 };
          else if (sql.startsWith('SELECT id, role')) { assert.match(sql, /FOR UPDATE/); return [local.user && local.user.email === args[0] ? [local.user] : []]; }
          else if (sql.startsWith('SELECT id FROM admin_tokens')) return [local.tokens.filter(t => t.hash === args[0])];
          else if (sql.startsWith('INSERT INTO admin_tokens')) local.tokens.push({ id: 1, hash: args[1], used: true });
          else if (sql.startsWith('UPDATE admin_users')) { local.user.passwordHash = args[0]; local.user.failedLoginCount = 0; local.user.lockedUntil = null; assert.doesNotMatch(sql, /mfa|role\s*=|status\s*=/); }
          else if (sql.startsWith('UPDATE admin_sessions')) local.revoked = true;
          else if (sql.startsWith('UPDATE admin_tokens')) local.tokens.forEach(t => { t.used = true; });
          else if (sql.startsWith('DELETE FROM admin_login_throttles')) args.forEach(key => { delete local.throttles[key]; });
          else if (sql.startsWith('INSERT INTO audit_log')) { if (failAudit) throw new Error('audit unavailable'); local.audit.push(args); }
          else throw new Error(`Unexpected query: ${sql}`);
          return [{ affectedRows: 1 }];
        },
      };
    },
  };
}

test('configuration and exact HTTPS origin reject disabled, expired and external requests', () => {
  const env = config();
  assert.equal(recoveryConfig(env).email, email);
  for (const change of [{ ADMIN_RECOVERY_CODE: '' }, { ADMIN_RECOVERY_EXPIRES_AT: 'invalid' }, { ADMIN_RECOVERY_EXPIRES_AT: new Date(0).toISOString() }, { ADMIN_RECOVERY_EXPIRES_AT: new Date(Date.now() + 48 * 3600000).toISOString() }]) assert.throws(() => recoveryConfig({ ...env, ...change }), { status: 404 });
  const request = origin => new Request('http://internal:3000/api/admin/recover', { headers: origin ? { origin, 'x-forwarded-host': 'evil.example' } : {} });
  assert.equal(recoveryOrigin(request('https://shop.example'), 'https://shop.example'), true);
  for (const origin of [undefined, 'null', 'http://shop.example', 'https://evil.example', 'https://shop.example.evil']) assert.equal(recoveryOrigin(request(origin), 'https://shop.example'), false);
});

test('new password works, old password fails, sessions/tokens revoked, MFA preserved and code single-use', async () => {
  const env = config(), pool = database();
  pool.state.user.passwordHash = await hashPassword('previous-test-password');
  pool.state.tokens.push({ hash: 'old-reset-token', used: false });
  pool.state.throttles[hashToken(`email:${email}`)] = { attempts: 5, recent: 1 };
  await recoverOwner(pool, body(env), 'test-ip', env);
  assert.equal(await verifyPassword(password, pool.state.user.passwordHash), true);
  assert.equal(await verifyPassword('previous-test-password', pool.state.user.passwordHash), false);
  assert.equal(pool.state.user.mfa, 'preserve-me');
  assert.equal(pool.state.user.failedLoginCount, 0);
  assert.equal(pool.state.user.lockedUntil, null);
  assert.equal(pool.state.revoked, true);
  assert.ok(pool.state.tokens.every(t => t.used));
  assert.ok(pool.state.tokens.some(t => t.hash === hashToken(env.ADMIN_RECOVERY_CODE)));
  assert.equal(pool.state.audit.length, 1);
  assert.equal(pool.state.throttles[hashToken(`email:${email}`)], undefined);
  assert.ok(!JSON.stringify(pool.state).includes(env.ADMIN_RECOVERY_CODE));
  await assert.rejects(recoverOwner(pool, body(env), 'test-ip', env), { status: 410 });
});

test('wrong code, email, password length and confirmation cause no account mutation', async () => {
  for (const change of [{ code: 'wrong' }, { email: 'other@example.com' }, { password: 'short' }, { password: 'x'.repeat(129) }, { confirmPassword: 'different' }]) {
    const env = config(), pool = database();
    await assert.rejects(recoverOwner(pool, { ...body(env), ...change }, 'test-ip', env), { status: 400 });
    assert.equal(pool.state.user.passwordHash, 'old');
    assert.equal(pool.state.tokens.length, 0);
  }
});

test('missing, suspended and non-owner accounts cannot be recovered', async () => {
  for (const kind of ['missing', 'suspended', 'manager', 'attendant']) {
    const env = config(), pool = database();
    if (kind === 'missing') pool.state.user.email = 'other@example.com';
    else if (kind === 'suspended') pool.state.user.status = kind;
    else pool.state.user.role = kind;
    await assert.rejects(recoverOwner(pool, body(env), 'test-ip', env), { status: 400 });
    assert.equal(pool.state.tokens.length, 0);
  }
});

test('five attempts persist and recovery limits remain separate from login', async () => {
  const env = config(), pool = database();
  for (let i = 0; i < 5; i++) await assert.rejects(recoverOwner(pool, { ...body(env), code: 'wrong' }, `ip-${i}`, env), { status: 400 });
  await assert.rejects(recoverOwner(pool, body(env), 'another-ip', env), { status: 429 });
  await takeAdminAttempt(pool, email, 'another-ip', 'login');
  const otherPool = database();
  for (let i = 0; i < 5; i++) await takeAdminAttempt(otherPool, `account-${i}`, 'same-ip');
  await assert.rejects(takeAdminAttempt(otherPool, 'account-new', 'same-ip'), { status: 429 });
});

test('concurrent requests consume once with transaction serialization', async () => {
  const env = config(), pool = database();
  const results = await Promise.allSettled([recoverOwner(pool, body(env), 'test-ip', env), recoverOwner(pool, body(env), 'test-ip', env)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 410);
  assert.equal(pool.state.audit.length, 1);
});

test('audit failure rolls back password, sessions and consumption; retry can succeed', async () => {
  const env = config(), pool = database();
  pool.failAudit = true;
  await assert.rejects(recoverOwner(pool, body(env), 'test-ip', env), /audit unavailable/);
  assert.equal(pool.state.user.passwordHash, 'old');
  assert.equal(pool.state.tokens.length, 0);
  assert.equal(pool.state.revoked, false);
  pool.failAudit = false;
  await recoverOwner(pool, body(env), 'test-ip', env);
  assert.equal(pool.state.audit.length, 1);
});
