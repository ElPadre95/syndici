'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Link, useRouter } from '@/i18n/navigation';
import {
  previewGenerationAction,
  generateLotsAction,
  type PreviewState,
} from '@/server/lots/actions';
import type { GroupRaw } from '@/server/lots/validation';

type ResidenceType = 'IMMEUBLE' | 'VILLA' | 'MIXTE';
const FIELD = 'rounded-md border border-sep px-3 py-2 font-normal';
const LABEL = 'flex flex-col gap-1 text-sm font-semibold text-label';

interface GroupState {
  count: string;
  scheme: 'continuous' | 'floor';
  prefix: string;
  floors: string;
}

/** Écran de génération en série (A3) : aperçu obligatoire avant création. */
export function GenerationForm({
  residenceType,
  defaultUnitsCount,
}: {
  residenceType: ResidenceType;
  defaultUnitsCount: number;
}) {
  const t = useTranslations('lots.generate');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const hasApt = residenceType === 'IMMEUBLE' || residenceType === 'MIXTE';
  const hasVilla = residenceType === 'VILLA' || residenceType === 'MIXTE';

  const [apt, setApt] = useState<GroupState>({
    count: String(hasApt ? (residenceType === 'MIXTE' ? defaultUnitsCount : defaultUnitsCount) : 0),
    scheme: 'floor',
    prefix: '',
    floors: '4',
  });
  const [villa, setVilla] = useState<GroupState>({
    count: String(residenceType === 'VILLA' ? defaultUnitsCount : 0),
    scheme: 'continuous',
    prefix: 'V',
    floors: '1',
  });

  function buildRaw(): GroupRaw[] {
    const groups: GroupRaw[] = [];
    if (hasApt)
      groups.push({
        type: 'APPARTEMENT',
        count: apt.count,
        scheme: apt.scheme,
        prefix: apt.prefix,
        floors: apt.floors,
      });
    if (hasVilla)
      groups.push({
        type: 'VILLA',
        count: villa.count,
        scheme: villa.scheme,
        prefix: villa.prefix,
        floors: villa.floors,
      });
    return groups;
  }

  function onPreview() {
    setFormError(null);
    startTransition(async () => setPreview(await previewGenerationAction(buildRaw())));
  }

  function onGenerate() {
    setFormError(null);
    startTransition(async () => {
      const res = await generateLotsAction(buildRaw());
      if (res.ok) router.push('/lots');
      else setFormError(t(`errors.${res.error}`));
    });
  }

  const canGenerate = preview?.ok === true && preview.preview.toCreate.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-label-3">{t('intro')}</p>

      <div className="flex flex-col gap-5">
        {hasApt && <GroupFields legend={t('apartments')} state={apt} setState={setApt} t={t} />}
        {hasVilla && <GroupFields legend={t('villas')} state={villa} setState={setVilla} t={t} />}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onPreview} disabled={pending}>
          {t('previewBtn')}
        </Button>
        <Button variant="primary" onClick={onGenerate} disabled={pending || !canGenerate}>
          {t('submit')}
        </Button>
        <Link href="/lots">
          <Button variant="ghost" type="button">
            {t('cancel')}
          </Button>
        </Link>
      </div>

      {formError && <p className="text-sm text-red">{formError}</p>}

      {preview && (
        <div className="rounded-lg border border-sep bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-label">{t('previewTitle')}</h2>
          {preview.ok ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-label">
                {t('willCreate', { count: preview.preview.toCreate.length })}
              </p>
              {preview.preview.toCreate.length === 0 ? (
                <p className="text-sm text-label-3">{t('nothingToCreate')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {preview.preview.toCreate.map((l) => (
                    <span
                      key={l.reference}
                      className="rounded-md bg-indigo-soft px-2 py-1 text-xs font-bold text-indigo"
                    >
                      {l.reference}
                    </span>
                  ))}
                </div>
              )}
              {preview.preview.conflicts.length > 0 && (
                <ChipList
                  title={t('conflictsTitle')}
                  items={preview.preview.conflicts}
                  tone="uns"
                />
              )}
              {preview.preview.duplicatesWithin.length > 0 && (
                <ChipList
                  title={t('duplicatesTitle')}
                  items={preview.preview.duplicatesWithin}
                  tone="warn"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-red">{t(`errors.${preview.error}`)}</p>
          )}
        </div>
      )}
    </div>
  );
}

function GroupFields({
  legend,
  state,
  setState,
  t,
}: {
  legend: string;
  state: GroupState;
  setState: React.Dispatch<React.SetStateAction<GroupState>>;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <fieldset className="rounded-lg border border-sep p-4">
      <legend className="px-1 text-sm font-bold text-label">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          {t('count')}
          <input
            type="number"
            min={0}
            step={1}
            value={state.count}
            onChange={(e) => setState((s) => ({ ...s, count: e.target.value }))}
            className={FIELD}
          />
        </label>
        <label className={LABEL}>
          {t('scheme')}
          <select
            value={state.scheme}
            onChange={(e) =>
              setState((s) => ({ ...s, scheme: e.target.value as GroupState['scheme'] }))
            }
            className={FIELD}
          >
            <option value="continuous">{t('schemeContinuous')}</option>
            <option value="floor">{t('schemeFloor')}</option>
          </select>
        </label>
        <label className={LABEL}>
          {t('prefix')}
          <input
            type="text"
            value={state.prefix}
            onChange={(e) => setState((s) => ({ ...s, prefix: e.target.value }))}
            className={FIELD}
          />
          <span className="text-xs font-normal text-label-4">{t('prefixHint')}</span>
        </label>
        {state.scheme === 'floor' && (
          <label className={LABEL}>
            {t('floors')}
            <input
              type="number"
              min={1}
              step={1}
              value={state.floors}
              onChange={(e) => setState((s) => ({ ...s, floors: e.target.value }))}
              className={FIELD}
            />
          </label>
        )}
      </div>
    </fieldset>
  );
}

function ChipList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'uns' | 'warn';
}) {
  const chip = tone === 'uns' ? 'bg-red-soft text-red' : 'bg-orange-soft text-orange';
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-semibold text-label-3">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((r) => (
          <span key={r} className={`rounded-md px-2 py-1 text-xs font-bold ${chip}`}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
