/**
 * Réglette de références de lot (J1) — élément de SIGNATURE tiré du produit (les 25 lots réels
 * de la Résidence Al Firdaous), pas un ornement. Monospace, graduations comme une règle de
 * mesure ; les débuts de bloc (A1/B1/C1/V1) sont marqués en cobalt. Sert de séparateur entre
 * sections. Défile horizontalement si l'écran est étroit, sans casser la mise en page.
 */
const LOTS = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7',
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6',
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
];
const BLOCK_START = new Set(['A1', 'B1', 'C1', 'V1']);

export function LotRuler({ label }: { label: string }) {
  return (
    <div className="v-ruler">
      <div className="mx-auto flex max-w-[1280px] items-stretch gap-6 overflow-x-auto px-6">
        <span
          className="v-mono flex shrink-0 items-center py-3 text-[0.68rem] uppercase tracking-wider"
          style={{ color: 'var(--ink-3)' }}
        >
          {label}
        </span>
        <div className="flex flex-1 items-end justify-between gap-3 pb-2 pt-3">
          {LOTS.map((ref) => {
            const strong = BLOCK_START.has(ref);
            return (
              <span key={ref} className="flex shrink-0 flex-col items-center gap-1">
                <span
                  style={{
                    width: '1px',
                    height: strong ? '12px' : '6px',
                    background: strong ? 'var(--accent)' : 'var(--line)',
                  }}
                />
                <span
                  className="v-mono text-[0.72rem]"
                  style={{
                    color: strong ? 'var(--ink)' : 'var(--ink-3)',
                    fontWeight: strong ? 600 : 400,
                  }}
                >
                  {ref}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
