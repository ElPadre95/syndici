'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, Upload, Download, AlertCircle, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { uploadDocumentAction } from '@/server/documents/actions';
import { DOCUMENT_TYPES, DEPOSABLE_SCOPES } from '@/server/documents/visibility';
import type { DocumentView } from '@/server/documents/data';

export interface DocumentRow extends DocumentView {
  href: string; // chemin signé (route /api/files/[id]) — calculé côté serveur
}

const SCOPE_STYLE: Record<string, string> = {
  RESIDENCE: 'bg-green-soft text-green',
  PARTAGE: 'bg-indigo-soft text-indigo',
  PRIVE: 'bg-bg text-label-4',
  INTERNE: 'bg-orange-soft text-orange',
};

/** Documents (F3) : dépôt (staff) + liste filtrable, consultation via route signée. */
export function DocumentsManager({ rows, canManage }: { rows: DocumentRow[]; canManage: boolean }) {
  const t = useTranslations('documents.f3');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [pending, start] = useTransition();

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (typeFilter === 'ALL' || r.type === typeFilter) &&
          (scopeFilter === 'ALL' || r.scope === scopeFilter),
      ),
    [rows, typeFilter, scopeFilter],
  );

  const submit = (form: HTMLFormElement) => {
    setError(null);
    setSaved(false);
    const fd = new FormData(form);
    start(async () => {
      const res = await uploadDocumentAction(fd);
      if (res.ok) {
        setSaved(true);
        form.reset();
        router.refresh();
      } else {
        setError(t(`err.${res.error}`));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Card>
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
            className="flex flex-col gap-3"
          >
            <h2 className="text-base font-bold text-label">{t('depositTitle')}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-semibold text-label-3">{t('field.name')}</span>
                <input
                  name="name"
                  required
                  placeholder={t('field.nameHint')}
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.type')}</span>
                <select
                  name="type"
                  defaultValue="AUTRE"
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                >
                  {DOCUMENT_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`type.${ty}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold text-label-3">{t('field.scope')}</span>
                <select
                  name="scope"
                  defaultValue="RESIDENCE"
                  className="rounded-md border border-sep px-3 py-2 text-sm"
                >
                  {DEPOSABLE_SCOPES.map((sc) => (
                    <option key={sc} value={sc}>
                      {t(`scope.${sc}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="font-semibold text-label-3">{t('field.file')}</span>
                <input
                  name="file"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="rounded-md border border-sep px-3 py-2 text-sm file:me-3 file:rounded file:border-0 file:bg-indigo-soft file:px-3 file:py-1 file:text-indigo"
                />
                <span className="text-xs text-label-4">{t('field.fileHint')}</span>
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
                <AlertCircle className="size-4 shrink-0" aria-hidden />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" disabled={pending}>
                <Upload className="size-4" aria-hidden />
                {t('deposit')}
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-sm font-semibold text-green">
                  <Check className="size-4" aria-hidden />
                  {t('saved')}
                </span>
              )}
            </div>
          </form>
        </Card>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-sep px-3 py-2 text-sm"
          aria-label={t('filterType')}
        >
          <option value="ALL">{t('type.all')}</option>
          {DOCUMENT_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`type.${ty}`)}
            </option>
          ))}
        </select>
        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value)}
          className="rounded-md border border-sep px-3 py-2 text-sm"
          aria-label={t('filterScope')}
        >
          <option value="ALL">{t('scope.all')}</option>
          {(['RESIDENCE', 'PARTAGE', 'PRIVE', 'INTERNE'] as const).map((sc) => (
            <option key={sc} value={sc}>
              {t(`scope.${sc}`)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-sep bg-white px-6 py-16 text-center">
          <FileText className="size-6 text-label-4" aria-hidden />
          <p className="text-sm font-semibold text-label-3">{t('empty')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((d) => (
            <li key={d.id}>
              <Card className="flex flex-wrap items-center gap-3 p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-indigo-soft text-indigo">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-label">{d.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-label-4">
                    <span>{t(`type.${d.type}`)}</span>
                    {d.lotReference && <span>· {t('lot', { lot: d.lotReference })}</span>}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    SCOPE_STYLE[d.scope] ?? 'bg-bg text-label-4',
                  )}
                >
                  {t(`scope.${d.scope}`)}
                </span>
                <a
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-indigo-soft px-3 py-1.5 text-xs font-bold text-indigo hover:bg-indigo-mid"
                >
                  <Download className="size-4" aria-hidden />
                  {t('open')}
                </a>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
