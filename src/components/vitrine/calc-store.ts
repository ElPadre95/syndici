'use client';

import { useSyncExternalStore } from 'react';

/**
 * État PARTAGÉ du calculateur d'ouverture (J1). Le visiteur saisit son nombre de lots (et sa
 * charge) une seule fois, en haut de page ; la section Tarifs affiche alors SON abonnement, et
 * le formulaire de contact pré-remplit SON nombre de lots. Un simple store client (aucun
 * serveur) mémoïsé en `localStorage` pour survivre au défilement et au rechargement.
 */
export interface CalcState {
  lots: number;
  charge: number;
  /** true dès que le visiteur a touché au calculateur (sinon on n'affiche pas « pour vous »). */
  touched: boolean;
}

const KEY = 'syndici.calc';
const DEFAULT: CalcState = { lots: 25, charge: 650, touched: false };

let state: CalcState = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<CalcState>;
      state = {
        lots: clampInt(p.lots, DEFAULT.lots, 9999),
        charge: clampInt(p.charge, DEFAULT.charge, 999999),
        touched: Boolean(p.touched),
      };
    }
  } catch {
    // localStorage indisponible ou JSON corrompu : on garde les valeurs par défaut.
  }
}

function clampInt(v: unknown, fallback: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

export function setCalc(patch: Partial<CalcState>): void {
  load();
  state = { ...state, ...patch, touched: true };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Écriture best-effort : l'app fonctionne sans persistance.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): CalcState {
  load();
  return state;
}

/** Lit l'état partagé, réactif. Sur le serveur, renvoie les valeurs par défaut (non « touched »). */
export function useCalc(): CalcState {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT);
}
