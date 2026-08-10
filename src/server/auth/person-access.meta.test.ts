/**
 * Test MÉTA (§2) — prouve, par typage/structure et non par convention, qu'AUCUN
 * module de production hors de `person-access.ts` ne lit ni n'écrit le modèle des
 * personnes. On scanne les sources : toute référence à la table `"Person"` ou à
 * l'accesseur Prisma `.person` en dehors de la couche dédiée fait échouer le gate.
 *
 * (Même esprit que le test méta TENANT_MODELS pour l'isolation tenant.)
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const ALLOWED = join(SRC, 'server', 'auth', 'person-access.ts');
// Les tests et les helpers de test peuvent semer des personnes librement.
const EXEMPT = (p: string) =>
  p === ALLOWED || p.endsWith('.test.ts') || p.includes(`${join('src', 'test')}`);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const PERSON_TABLE = /"Person"/;
const PERSON_ACCESSOR = /\.person\b/;

describe('meta — Person is only reachable through person-access.ts', () => {
  it('no production module outside the access layer references Person', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      if (EXEMPT(file)) continue;
      const src = readFileSync(file, 'utf8');
      if (PERSON_TABLE.test(src) || PERSON_ACCESSOR.test(src)) {
        offenders.push(file.replace(`${process.cwd()}/`, ''));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the access layer itself does reference Person (sanity: the guard is real)', () => {
    const src = readFileSync(ALLOWED, 'utf8');
    expect(PERSON_TABLE.test(src)).toBe(true);
  });
});
