/**
 * Attestation de non-dette (I4) — document imprimable (`data-print-root`). Certifie qu'un lot
 * est à jour de ses charges (aucun reste dû). Présentation pure ; le texte vient des catalogues
 * (fr/ar). N'est rendue par la page QUE si le solde du compte est nul ou créditeur.
 */
export function AttestationDocument({
  residence,
  lotReference,
  ownerName,
  dateLabel,
  title,
  body,
  refLabel,
  signatureLabel,
}: {
  residence: { name: string; orgName: string | null };
  lotReference: string;
  ownerName: string | null;
  dateLabel: string;
  title: string;
  body: string;
  refLabel: string;
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

      <p className="text-end text-sm text-label-3">{dateLabel}</p>

      <h1 className="text-center text-lg font-extrabold uppercase tracking-wide text-label">
        {title}
      </h1>

      <p className="whitespace-pre-line text-sm leading-relaxed text-label">{body}</p>

      <p className="text-xs text-label-4">
        {refLabel} : {lotReference}
        {ownerName ? ` — ${ownerName}` : ''}
      </p>

      <p className="mt-6 text-end text-sm font-semibold text-label-2">{signatureLabel}</p>
    </article>
  );
}
