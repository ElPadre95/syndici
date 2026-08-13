/**
 * Driver de stockage LOCAL (C0) — mode développement, sans réseau. Écrit les octets
 * sous une racine (`.storage/` par défaut, gitignorée). La référence persistée est le
 * chemin logique relatif. Toute résolution est bornée à la racine (pas de traversée).
 */
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { StorageDriver } from '../types';

export function localDiskDriver(baseDir: string): StorageDriver {
  const root = resolve(baseDir);
  const fullPath = (ref: string): string => {
    const p = resolve(root, ref);
    if (p !== root && !p.startsWith(root + sep)) {
      throw new Error('Référence de stockage hors de la racine.');
    }
    return p;
  };
  return {
    name: 'local',
    async put(key, body) {
      const p = fullPath(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
      return key;
    },
    async get(ref) {
      try {
        return await readFile(fullPath(ref));
      } catch {
        return null;
      }
    },
    async delete(ref) {
      try {
        await unlink(fullPath(ref));
      } catch {
        // déjà absent : rien à faire
      }
    },
  };
}
