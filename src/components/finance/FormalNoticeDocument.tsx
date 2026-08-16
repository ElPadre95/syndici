/**
 * Lettre de MISE EN DEMEURE (I4) — document imprimable (`data-print-root`). Présentation
 * pure : en-tête (cabinet → résidence), date, destinataire, objet, corps formel (texte déjà
 * composé, catalogue fr/ar), et signature. Le corps affiché est EXACTEMENT celui persisté
 * comme preuve.
 */
export function FormalNoticeDocument({
  residence,
  lotReference,
  recipientName,
  dateLabel,
  title,
  toLabel,
  subjectLabel,
  lotLabel,
  body,
  signatureLabel,
}: {
  residence: { name: string; orgName: string | null };
  lotReference: string;
  recipientName: string | null;
  dateLabel: string;
  title: string;
  toLabel: string;
  subjectLabel: string;
  lotLabel: string;
  body: string;
  signatureLabel: string;
}) {
  return (
    <article
      data-print-root
      className="flex w-full flex-col gap-6 rounded-lg border border-sep bg-white p-8"
    >
      <header className="flex flex-col gap-1 border-b border-sep pb-4">
        {residence.orgName && (
          <p className="text-xs font-bold uppercase tracking-wide text-label-4">
            {residence.orgName}
          </p>
        )}
        <p className="text-lg font-extrabold text-label">{residence.name}</p>
      </header>

      <div className="flex flex-col gap-1 text-sm text-label-2">
        <p className="text-end text-label-3">{dateLabel}</p>
        <p>
          <span className="font-semibold text-label-4">{toLabel} : </span>
          {recipientName ?? '—'}
        </p>
        <p>
          <span className="font-semibold text-label-4">{lotLabel} : </span>
          {lotReference}
        </p>
      </div>

      <h1 className="text-center text-lg font-extrabold uppercase tracking-wide text-label">
        {title}
      </h1>
      <p className="text-center text-sm font-semibold text-label-3">{subjectLabel}</p>

      <p className="whitespace-pre-line text-sm leading-relaxed text-label">{body}</p>

      <p className="mt-6 text-end text-sm font-semibold text-label-2">{signatureLabel}</p>
    </article>
  );
}
