'use client';

import { useRef, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';
import { previewImportAction, commitImportAction } from '@/server/import/actions';
import type { ImportPlan, RowStatus } from '@/server/import/plan';
import type { ImportReport } from '@/server/import/commit';
import type { ImportActionError } from '@/server/import/action-types';

const FILE_ERRORS = new Set(['too_large', 'too_many_rows', 'unreadable', 'no_columns']);

const STATUS_TONE: Record<RowStatus, string> = {
  create: 'bg-green-soft text-green',
  exists: 'bg-bg text-label-3',
  reject: 'bg-orange-soft text-orange',
};

/**
 * Assistant d'import (A7) — garde le fichier en mémoire client : aperçu d'abord
 * (aucune écriture), puis confirmation qui RELIT le même fichier côté serveur.
 */
export function ImportWizard() {
  const t = useTranslations('lots.import');
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const errorLabel = (code: ImportActionError): string =>
    FILE_ERRORS.has(code)
      ? t(`fileError.${code}`)
      : code === 'forbidden'
        ? t('forbidden')
        : t('noResidence');

  const analyze = (f: File) => {
    setFile(f);
    setPlan(null);
    setReport(null);
    setError(null);
    const fd = new FormData();
    fd.set('file', f);
    fd.set('filename', f.name);
    start(async () => {
      const res = await previewImportAction(fd);
      if (res.ok) setPlan(res.plan);
      else setError(errorLabel(res.error));
    });
  };

  const confirm = () => {
    if (!file) return;
    const fd = new FormData();
    fd.set('file', file);
    fd.set('filename', file.name);
    start(async () => {
      const res = await commitImportAction(fd);
      if (res.ok) {
        setReport(res.report);
        setPlan(null);
      } else setError(errorLabel(res.error));
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Zone de dépôt + lien vers le modèle */}
      <Card>
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) analyze(f);
            }}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-sep bg-bg px-6 py-10 text-center transition-colors hover:border-indigo"
          >
            <UploadCloud className="size-8 text-label-4" aria-hidden />
            <span className="text-base font-bold text-label">{t('dropzoneTitle')}</span>
            <span className="max-w-sm text-sm text-label-3">{t('dropzoneHint')}</span>
            {file && (
              <span className="mt-1 flex items-center gap-2 text-sm font-semibold text-indigo">
                <FileSpreadsheet className="size-4" aria-hidden />
                {file.name}
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) analyze(f);
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <a
              href={`/${locale}/lots/import/modele`}
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo hover:underline"
            >
              <Download className="size-4" aria-hidden />
              {t('templateLink')}
            </a>
            {pending && (
              <span className="text-sm text-label-3">
                {report ? t('importing') : t('analyzing')}
              </span>
            )}
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-orange-soft px-4 py-3 text-sm font-semibold text-orange">
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {plan && !report && <PreviewTable plan={plan} onConfirm={confirm} pending={pending} />}

      {report && (
        <Card>
          <div className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-base font-bold text-label">
              <CheckCircle2 className="size-5 text-green" aria-hidden />
              {t('report.title')}
            </h2>
            <ul className="flex flex-col gap-1 text-sm text-label-3">
              <li>{t('report.lotsCreated', { count: report.lotsCreated })}</li>
              <li>{t('report.personsCreated', { count: report.personsCreated })}</li>
              <li>{t('report.personsAttached', { count: report.personsAttached })}</li>
              <li>{t('report.ignored', { count: report.ignored })}</li>
            </ul>
            <div>
              <Link href="/lots">
                <Button variant="primary">{t('report.backToLots')}</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function PreviewTable({
  plan,
  onConfirm,
  pending,
}: {
  plan: ImportPlan;
  onConfirm: () => void;
  pending: boolean;
}) {
  const t = useTranslations('lots.import');
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-label">{t('preview.title')}</h2>
            <p className="mt-1 text-sm text-label-3">
              {t('preview.summary', {
                create: plan.counts.create,
                exists: plan.counts.exists,
                reject: plan.counts.reject,
              })}
            </p>
          </div>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={pending || plan.counts.create === 0}
          >
            {t('preview.confirm', { count: plan.counts.create })}
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-sep">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-sep text-xs font-bold uppercase tracking-wide text-label-4">
                <th className="px-3 py-2 text-start">{t('preview.colRow')}</th>
                <th className="px-3 py-2 text-start">{t('preview.colRef')}</th>
                <th className="px-3 py-2 text-start">{t('preview.colOwner')}</th>
                <th className="px-3 py-2 text-start">{t('preview.colStatus')}</th>
                <th className="px-3 py-2 text-start">{t('preview.colDetail')}</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((r) => (
                <tr key={r.rowNumber} className="border-b border-sep last:border-0">
                  <td className="px-3 py-2 text-label-4">{r.rowNumber}</td>
                  <td className="px-3 py-2 font-semibold text-label">
                    {r.reference || t('preview.empty')}
                  </td>
                  <td className="px-3 py-2 text-label-3">{r.ownerName ?? t('preview.empty')}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold',
                        STATUS_TONE[r.status],
                      )}
                    >
                      {t(`status.${r.status}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-label-3">
                    {r.reason ? t(`reason.${r.reason}`) : t('preview.empty')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
