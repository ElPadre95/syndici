import { getTranslations, getLocale } from 'next-intl/server';
import { ArrowRight, Paperclip } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import type { IncidentListRow } from '@/server/incidents/data';

function statusTone(s: IncidentListRow['status']): 'success' | 'warning' | 'neutral' {
  return s === 'RESOLU' ? 'success' : s === 'EN_COURS' ? 'warning' : 'neutral';
}
function urgencyTone(u: IncidentListRow['urgency']): 'danger' | 'warning' | 'neutral' {
  return u === 'URGENTE' ? 'danger' : u === 'IMPORTANTE' ? 'warning' : 'neutral';
}

/** Liste d'incidents (H1) — partagée propriétaire / syndic. Déjà triée en amont. */
export async function IncidentList({
  rows,
  baseHref,
  emptyKey,
}: {
  rows: IncidentListRow[];
  baseHref: string;
  emptyKey: 'empty' | 'emptyStaff';
}) {
  const t = await getTranslations('incidents');
  const locale = await getLocale();
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

  if (rows.length === 0) {
    return <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">{t(emptyKey)}</p>;
  }

  return (
    <Table className="min-w-[640px]">
      <THead>
        <Tr>
          <Th>{t('colUrgency')}</Th>
          <Th>{t('colCategory')}</Th>
          <Th>{t('colLocation')}</Th>
          <Th>{t('colLot')}</Th>
          <Th>{t('colStatus')}</Th>
          <Th>{t('colDate')}</Th>
          <Th className="text-end">{t('open')}</Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map((r) => (
          <Tr key={r.id}>
            <Td>
              <Badge tone={urgencyTone(r.urgency)}>{t(`urgency${r.urgency}`)}</Badge>
            </Td>
            <Td className="font-semibold text-label">
              <span className="inline-flex items-center gap-1.5">
                {r.category}
                {r.hasExpense && <Paperclip className="size-3.5 text-indigo" aria-hidden />}
              </span>
            </Td>
            <Td className="text-label-3">{r.location}</Td>
            <Td className="text-label-3">{r.lotReference ?? t('commonAreaLabel')}</Td>
            <Td>
              <Badge tone={statusTone(r.status)}>{t(`status${r.status}`)}</Badge>
            </Td>
            <Td className="whitespace-nowrap text-note text-label-4">{day(r.reportedAt)}</Td>
            <Td className="text-end">
              <Link
                href={`${baseHref}/${r.id}`}
                className="inline-flex items-center gap-1 text-note font-bold text-indigo hover:underline"
              >
                {t('open')}
                <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
              </Link>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
