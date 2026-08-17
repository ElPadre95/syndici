/**
 * Capture flottante (J) — un CADRE SERRÉ sur une zone lisible (crop d'un élément `data-shot`),
 * jamais un écran entier rétréci. Ombre douce (`.v-float`), coins arrondis, légère inclinaison,
 * ratio NATUREL du crop préservé (aucune déformation). Les crops ont des dimensions variées :
 * une simple `<img>` respecte leur ratio sans qu'on ait à coder chaque taille.
 */
export function Shot({
  src,
  alt,
  className,
  rotate = 0,
}: {
  src: string;
  alt: string;
  className?: string;
  rotate?: number;
}) {
  return (
    <div className={className}>
      <div
        className="v-float overflow-hidden"
        style={{ background: 'var(--white)', transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- crop marketing statique : ratio naturel préservé, chargé en lazy */}
        <img src={src} alt={alt} className="block h-auto w-full" loading="lazy" decoding="async" />
      </div>
    </div>
  );
}
