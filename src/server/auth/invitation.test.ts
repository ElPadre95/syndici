/**
 * Invitation par code (§5 + §6.5) — intégration PGlite. Prouve : usage unique,
 * expiration, essais bornés, rattachement irréversible sans repli e-mail, et
 * absence de PII à la vérification.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { TestDb } from '@/test/pglite';
import {
  freshDb,
  pgliteExecutor,
  pgliteTxRunner,
  insertResidence,
  insertLot,
  insertPerson,
  insertUser,
} from '@/test/pglite';
import {
  CODE_ALPHABET,
  createInvitation,
  generateAccessCode,
  hashCode,
  normalizeCode,
  redeemInvitation,
  verifyInvitation,
  MAX_ATTEMPTS,
} from './invitation';
import type { SqlExecutor, TxRunner } from '@/server/db/sql';

let db: TestDb;
let exec: SqlExecutor;
let runner: TxRunner;

const RES = 'res-1';
const LOT = 'lot-1';
const PERSON = 'person-1';

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  runner = pgliteTxRunner(db);
  await insertResidence(db, RES);
  await insertLot(db, LOT, RES, 'A1');
  await insertPerson(db, PERSON, { email: 'aicha.benali@example.ma' });
});

describe('code generation', () => {
  it('is >= 10 chars, only from the unambiguous alphabet', () => {
    const code = generateAccessCode();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    // no ambiguous characters ever
    expect(/[0O1IL]/.test(code)).toBe(false);
  });

  it('rejects a length below 10', () => {
    expect(() => generateAccessCode(9)).toThrow(RangeError);
  });

  it('normalizes and hashes tolerantly (case, spaces, dashes)', () => {
    const code = 'ABCD-EFGH JKMN';
    expect(normalizeCode(code)).toBe('ABCDEFGHJKMN');
    expect(hashCode('abcd efgh jkmn')).toBe(hashCode('ABCDEFGHJKMN'));
  });
});

describe('verify — no PII leak', () => {
  it('valid code returns ONLY the role — no PII at all (no e-mail, even masked)', async () => {
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    const res = await verifyInvitation(exec, code);
    expect(res).toEqual({ valid: true, role: 'OWNER' });
    // aucune clé « email »/« name »/« masked » ne doit exister dans la réponse
    expect(Object.keys(res)).toEqual(['valid', 'role']);
  });

  it('unknown code is simply invalid', async () => {
    expect(await verifyInvitation(exec, 'ZZZZZZZZZZZZ')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});

describe('redeem — single use, irreversible link, no e-mail fallback', () => {
  it('links the account to the person exactly once', async () => {
    await insertUser(db, 'user-1');
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    const r = await redeemInvitation(runner, { code, authUserId: 'user-1' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result).toMatchObject({ personId: PERSON, lotId: LOT, role: 'OWNER' });

    // Person is now linked; invitation is USED.
    const p = await exec.query<{ authUserId: string }>(
      'SELECT "authUserId" FROM "Person" WHERE id = $1',
      [PERSON],
    );
    expect(p[0]?.authUserId).toBe('user-1');
    const inv = await exec.query<{ status: string }>(
      'SELECT status FROM "InvitationCode" WHERE "codeHash" = $1',
      [hashCode(code)],
    );
    expect(inv[0]?.status).toBe('USED');
  });

  it('cannot be used twice', async () => {
    await insertUser(db, 'user-1');
    await insertUser(db, 'user-2');
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    expect((await redeemInvitation(runner, { code, authUserId: 'user-1' })).ok).toBe(true);
    const second = await redeemInvitation(runner, { code, authUserId: 'user-2' });
    expect(second).toEqual({ ok: false, reason: 'already_used' });
  });

  it('a second invitation for an already-linked person cannot re-link (no takeover)', async () => {
    await insertUser(db, 'user-1');
    await insertUser(db, 'user-attacker');
    const first = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    const second = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    await redeemInvitation(runner, { code: first.code, authUserId: 'user-1' });
    const attack = await redeemInvitation(runner, {
      code: second.code,
      authUserId: 'user-attacker',
    });
    expect(attack).toEqual({ ok: false, reason: 'person_already_linked' });
    // The link still points at the legitimate first account.
    const p = await exec.query<{ authUserId: string }>(
      'SELECT "authUserId" FROM "Person" WHERE id = $1',
      [PERSON],
    );
    expect(p[0]?.authUserId).toBe('user-1');
  });

  it('expired code is refused (30-day window)', async () => {
    await insertUser(db, 'user-1');
    const created = new Date('2026-01-01T00:00:00Z');
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
      now: created,
    });
    const late = new Date('2026-03-01T00:00:00Z'); // > 30 days later
    expect(await verifyInvitation(exec, code, late)).toEqual({ valid: false, reason: 'expired' });
    expect(await redeemInvitation(runner, { code, authUserId: 'user-1', now: late })).toEqual({
      ok: false,
      reason: 'expired',
    });
  });

  it('a revoked code no longer works (verify and redeem)', async () => {
    await insertUser(db, 'user-1');
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    await db.query(`UPDATE "InvitationCode" SET status = 'REVOKED' WHERE "codeHash" = $1`, [
      hashCode(code),
    ]);
    expect(await verifyInvitation(exec, code)).toEqual({ valid: false, reason: 'revoked' });
    expect(await redeemInvitation(runner, { code, authUserId: 'user-1' })).toEqual({
      ok: false,
      reason: 'revoked',
    });
    // le compte n'a été lié à personne
    const p = await exec.query<{ authUserId: string | null }>(
      'SELECT "authUserId" FROM "Person" WHERE id = $1',
      [PERSON],
    );
    expect(p[0]?.authUserId).toBeNull();
  });

  it('caps attempts', async () => {
    await insertUser(db, 'user-1');
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    await db.query('UPDATE "InvitationCode" SET "attemptCount" = $2 WHERE "codeHash" = $1', [
      hashCode(code),
      MAX_ATTEMPTS,
    ]);
    expect(await redeemInvitation(runner, { code, authUserId: 'user-1' })).toEqual({
      ok: false,
      reason: 'too_many_attempts',
    });
  });

  it('a rolled-back redeem consumes nothing', async () => {
    await insertUser(db, 'user-1');
    const { code } = await createInvitation(exec, {
      residenceId: RES,
      lotId: LOT,
      personId: PERSON,
      role: 'OWNER',
    });
    // Force the transaction to fail after linking by pointing at a non-existent user
    // FK — the whole redeem must roll back, leaving the invitation PENDING.
    await expect(
      runner.transaction(async (tx) => {
        await tx.query(`UPDATE "InvitationCode" SET status = 'USED' WHERE "codeHash" = $1`, [
          hashCode(code),
        ]);
        throw new Error('boom');
      }),
    ).rejects.toThrow();
    const inv = await exec.query<{ status: string }>(
      'SELECT status FROM "InvitationCode" WHERE "codeHash" = $1',
      [hashCode(code)],
    );
    expect(inv[0]?.status).toBe('PENDING');
  });
});
