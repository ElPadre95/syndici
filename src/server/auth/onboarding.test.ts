/**
 * Mot de passe + onboarding (§1/§5) — intégration PGlite.
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
} from '@/test/pglite';
import {
  authenticatePassword,
  createUserWithPassword,
  hashPassword,
  WeakPasswordError,
  MIN_PASSWORD_LENGTH,
} from './password';
import { createInvitation } from './invitation';
import { onboardWithPassword } from './onboarding';
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
  await insertPerson(db, PERSON, { email: 'resident@example.ma' });
});

describe('password hashing (§1: min 10 chars)', () => {
  it('rejects a password shorter than 10 chars', async () => {
    await expect(hashPassword('short')).rejects.toBeInstanceOf(WeakPasswordError);
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });

  it('authenticates only with the correct password', async () => {
    const id = await createUserWithPassword(exec, 'jean@example.ma', 'motdepasse-solide');
    expect(await authenticatePassword(exec, 'jean@example.ma', 'motdepasse-solide')).toEqual({
      id,
      email: 'jean@example.ma',
    });
    expect(await authenticatePassword(exec, 'jean@example.ma', 'mauvais-mot-de-passe')).toBeNull();
    expect(await authenticatePassword(exec, 'inconnu@example.ma', 'motdepasse-solide')).toBeNull();
  });

  it('never overwrites an existing account (no takeover)', async () => {
    await createUserWithPassword(exec, 'jean@example.ma', 'premier-mot-de-passe');
    await expect(
      createUserWithPassword(exec, 'jean@example.ma', 'second-mot-de-passe'),
    ).rejects.toThrow();
    // le premier mot de passe fonctionne toujours
    expect(
      await authenticatePassword(exec, 'jean@example.ma', 'premier-mot-de-passe'),
    ).not.toBeNull();
  });
});

describe('onboardWithPassword — end to end', () => {
  async function invite() {
    return (
      await createInvitation(exec, {
        residenceId: RES,
        lotId: LOT,
        personId: PERSON,
        role: 'OWNER',
      })
    ).code;
  }

  it('creates the account and links it to the person', async () => {
    const code = await invite();
    const r = await onboardWithPassword(exec, runner, {
      code,
      email: 'new@example.ma',
      password: 'un-mot-de-passe-ok',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p = await exec.query<{ authUserId: string }>(
        'SELECT "authUserId" FROM "Person" WHERE id = $1',
        [PERSON],
      );
      expect(p[0]?.authUserId).toBe(r.userId);
      // et le nouveau compte peut se connecter
      expect(
        await authenticatePassword(exec, 'new@example.ma', 'un-mot-de-passe-ok'),
      ).not.toBeNull();
    }
  });

  it('rejects a weak password before creating anything', async () => {
    const code = await invite();
    expect(
      await onboardWithPassword(exec, runner, { code, email: 'x@e.ma', password: 'court' }),
    ).toEqual({
      ok: false,
      reason: 'weak_password',
    });
    expect(await exec.query('SELECT id FROM "User"')).toHaveLength(0);
  });

  it('rejects an invalid code without creating an account', async () => {
    expect(
      await onboardWithPassword(exec, runner, {
        code: 'ZZZZZZZZZZZZ',
        email: 'x@e.ma',
        password: 'un-mot-de-passe-ok',
      }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(await exec.query('SELECT id FROM "User"')).toHaveLength(0);
  });

  it('rejects when the e-mail already has an account (must sign in instead)', async () => {
    await createUserWithPassword(exec, 'taken@example.ma', 'deja-un-compte');
    const code = await invite();
    expect(
      await onboardWithPassword(exec, runner, {
        code,
        email: 'taken@example.ma',
        password: 'un-mot-de-passe-ok',
      }),
    ).toEqual({ ok: false, reason: 'email_taken' });
    // l'invitation n'a pas été consommée
    const inv = await exec.query<{ status: string }>('SELECT status FROM "InvitationCode"');
    expect(inv[0]?.status).toBe('PENDING');
  });
});
