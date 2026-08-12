/** Résultats des actions d'import (partagés action serveur ↔ UI). */
import type { ImportFileErrorCode } from './parse';
import type { ImportPlan } from './plan';
import type { ImportReport } from './commit';

export type ImportActionError = 'forbidden' | 'no_active_residence' | ImportFileErrorCode;

export type PreviewResult =
  { ok: true; plan: ImportPlan } | { ok: false; error: ImportActionError };

export type CommitResult =
  { ok: true; report: ImportReport } | { ok: false; error: ImportActionError };
