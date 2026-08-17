'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Paperclip, Check, Plus, Camera, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatMoney } from '@/lib/money';
import {
  addQuoteAction,
  selectQuoteAction,
  addPhotoAction,
  updateWorksStatusAction,
} from '@/server/works/actions';
import type { WorksProjectDetail, WorksPhotoView } from '@/server/works/data';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function WorksDetailPanel({
  detail,
  locale,
}: {
  detail: WorksProjectDetail;
  locale: string;
}) {
  const t = useTranslations('travaux');
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fmt = (m: number) => formatMoney(m, locale);
  const day = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(iso),
    );

  function run(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, fd: FormData): void {
    setError(null);
    start(async () => {
      const res = await action(fd);
      if (res.ok) router.refresh();
      else setError(t(`error.${res.error}`));
    });
  }

  const gallery = (photos: WorksPhotoView[], emptyKey: 'noPhotosBefore' | 'noPhotosAfter') =>
    photos.length === 0 ? (
      <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">{t(emptyKey)}</p>
    ) : (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((ph) => (
          <figure key={ph.id} className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ph.href}
              alt={ph.caption ?? ''}
              className="aspect-square w-full rounded-md border border-sep object-cover"
            />
            {ph.caption && <figcaption className="text-note text-label-4">{ph.caption}</figcaption>}
          </figure>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {/* Statut */}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-body font-bold text-label">{t('statusTitle')}</span>
        <form
          action={(fd) => run(updateWorksStatusAction, fd)}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="projectId" value={detail.id} />
          <select
            name="status"
            defaultValue={detail.status}
            className="rounded-md border border-sep bg-white px-3 py-2 text-sm"
          >
            <option value="CONSULTATION">{t('status.CONSULTATION')}</option>
            <option value="EN_COURS">{t('status.EN_COURS')}</option>
            <option value="TERMINE">{t('status.TERMINE')}</option>
          </select>
          <Button type="submit" variant="ghost" loading={pending}>
            {t('save')}
          </Button>
        </form>
      </Card>

      {/* Devis comparatifs */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('quotesTitle')}</h2>
        {detail.quotes.length === 0 ? (
          <p className="rounded-md bg-bg px-3 py-6 text-center text-note text-label-4">
            {t('noQuotes')}
          </p>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sep text-note uppercase text-label-4">
                  <th className="px-4 py-2.5 text-start font-bold">{t('col.supplier')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{t('col.amount')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('col.date')}</th>
                  <th className="px-4 py-2.5 text-end font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-sep">
                {detail.quotes.map((q) => (
                  <tr key={q.id} className={q.selected ? 'bg-green-soft' : undefined}>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-label">{q.supplierName}</span>
                      <span className="ms-2 inline-flex gap-1 align-middle">
                        {q.cheapest && <Badge tone="success">{t('cheapest')}</Badge>}
                        {q.selected && <Badge tone="info">{t('selected')}</Badge>}
                      </span>
                      {q.description && (
                        <p className="text-note text-label-4">{q.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end font-bold tabular-nums text-label">
                      {fmt(q.amountMinor)}
                    </td>
                    <td className="px-4 py-3 text-label-3">{day(q.receivedOn)}</td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {q.fileHref && (
                          <a
                            href={q.fileHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-soft px-2.5 py-1.5 text-note font-bold text-indigo hover:bg-indigo-mid"
                          >
                            <Paperclip className="size-3.5" aria-hidden />
                            {t('viewDevis')}
                          </a>
                        )}
                        {!q.selected && (
                          <form action={(fd) => run(selectQuoteAction, fd)}>
                            <input type="hidden" name="projectId" value={detail.id} />
                            <input type="hidden" name="quoteId" value={q.id} />
                            <Button type="submit" variant="secondary" loading={pending}>
                              <Check className="size-4" aria-hidden />
                              {t('select')}
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Ajouter un devis */}
        <Card className="flex flex-col gap-3">
          <h3 className="text-body font-bold text-label">{t('addQuote')}</h3>
          <form action={(fd) => run(addQuoteAction, fd)} className="flex flex-col gap-3">
            <input type="hidden" name="projectId" value={detail.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.supplier')}</span>
                <input name="supplierName" className="rounded-md border border-sep px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.amount')}</span>
                <input name="amount" inputMode="decimal" placeholder="0,00" className="rounded-md border border-sep px-3 py-2 text-sm tabular-nums" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.date')}</span>
                <input name="receivedOn" type="date" defaultValue={today()} className="rounded-md border border-sep px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.devis')}</span>
                <input name="devis" type="file" accept="application/pdf,image/*" className="text-sm" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-label-3">{t('field.note')}</span>
              <input name="description" className="rounded-md border border-sep px-3 py-2 text-sm" />
            </label>
            <Button type="submit" loading={pending} className="self-start">
              <Plus className="size-4" aria-hidden />
              {t('addQuote')}
            </Button>
          </form>
        </Card>
      </section>

      {/* Photos avant / après */}
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold text-label">{t('photosTitle')}</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h3 className="text-body font-bold text-label-2">{t('phaseLabel.AVANT')}</h3>
            {gallery(detail.photosBefore, 'noPhotosBefore')}
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-body font-bold text-label-2">{t('phaseLabel.APRES')}</h3>
            {gallery(detail.photosAfter, 'noPhotosAfter')}
          </div>
        </div>

        <Card className="flex flex-col gap-3">
          <h3 className="text-body font-bold text-label">{t('addPhoto')}</h3>
          <form action={(fd) => run(addPhotoAction, fd)} className="flex flex-col gap-3">
            <input type="hidden" name="projectId" value={detail.id} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.phase')}</span>
                <select name="phase" defaultValue="AVANT" className="rounded-md border border-sep bg-white px-3 py-2 text-sm">
                  <option value="AVANT">{t('phaseLabel.AVANT')}</option>
                  <option value="APRES">{t('phaseLabel.APRES')}</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.caption')}</span>
                <input name="caption" className="rounded-md border border-sep px-3 py-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.photo')}</span>
                <input name="photo" type="file" accept="image/*" capture="environment" className="text-sm" />
              </label>
            </div>
            <Button type="submit" loading={pending} className="self-start">
              <Camera className="size-4" aria-hidden />
              {t('addPhoto')}
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
