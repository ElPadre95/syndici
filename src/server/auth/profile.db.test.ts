/**
 * Profil du propriétaire (H7) — un propriétaire ne modifie QUE sa propre fiche, et le
 * changement de mot de passe EXIGE l'ancien. PGlite + Postgres réel.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { TestDb } from '@/test/pglite';
import { freshDb, pgliteExecutor, insertPerson } from '@/test/pglite';
import { getOwnProfile, updateOwnProfile } from './person-access';
import { changePassword, authenticatePassword, createUserWithPassword } from './password';
import type { SqlExecutor } from '@/server/db/sql';

let db: TestDb;
let exec: SqlExecutor;

beforeEach(async () => {
  db = await freshDb();
  exec = pgliteExecutor(db);
  await insertPerson(db, 'p-a', { email: 'a@mre.fr', phone: '+33600000000' });
  await insertPerson(db, 'p-b', { email: 'b@mre.fr', phone: '+33611111111' });
});

describe('updateOwnProfile — la fiche du déclarant SEULEMENT', () => {
  it('modifie A (téléphone, langue, devise) sans toucher B', async () => {
    await updateOwnProfile(exec, 'p-a', {
      phone: '+32470000000',
      preferredLocale: 'ar',
      secondaryCurrency: 'EUR',
    });
    const a = await getOwnProfile(exec, 'p-a');
    const b = await getOwnProfile(exec, 'p-b');
    expect(a).toMatchObject({ phone: '+32470000000', preferredLocale: 'ar', secondaryCurrency: 'EUR' });
    // B est intact : jamais la fiche d'un autre.
    expect(b).toMatchObject({ phone: '+33611111111', preferredLocale: 'fr', secondaryCurrency: null });
  });

  it("ne change PAS le nom (il reste au syndic)", async () => {
    await updateOwnProfile(exec, 'p-a', { phone: null, preferredLocale: 'fr', secondaryCurrency: null });
    const a = await getOwnProfile(exec, 'p-a');
    expect(a?.firstName).toBe('Prénom'); // valeur posée par insertPerson, inchangée
  });
});

describe('changePassword — exige l\'ancien, borné au bon compte', () => {
  // bcrypt (12 tours) est lent : plusieurs hachages ici → timeout généreux comme l'onboarding.
  it('refuse un mauvais ancien, accepte le bon, et n\'affecte pas un autre compte', async () => {
    const userA = await createUserWithPassword(exec, 'owner-a@mail.fr', 'ancienMotDePasse');
    await createUserWithPassword(exec, 'owner-b@mail.fr', 'motDePasseB!');

    // Mauvais ancien → refusé.
    expect(await changePassword(exec, userA, 'FAUX-ancien', 'nouveauMotDePasse')).toEqual({
      ok: false,
      reason: 'wrong_old',
    });
    // Nouveau trop court → refusé.
    expect(await changePassword(exec, userA, 'ancienMotDePasse', 'court')).toEqual({
      ok: false,
      reason: 'weak',
    });
    // Bon ancien + nouveau valide → OK.
    expect(await changePassword(exec, userA, 'ancienMotDePasse', 'nouveauMotDePasse')).toEqual({ ok: true });

    // L'ancien ne marche plus, le nouveau marche.
    expect(await authenticatePassword(exec, 'owner-a@mail.fr', 'ancienMotDePasse')).toBeNull();
    expect(await authenticatePassword(exec, 'owner-a@mail.fr', 'nouveauMotDePasse')).not.toBeNull();
    // Le compte B est intact.
    expect(await authenticatePassword(exec, 'owner-b@mail.fr', 'motDePasseB!')).not.toBeNull();
  }, 30000);
});
