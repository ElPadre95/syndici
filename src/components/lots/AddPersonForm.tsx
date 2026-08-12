'use client';

import { useActionState, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import {
  addPersonAction,
  searchPersonsAction,
  type PersonCandidate,
} from '@/server/lots/attach-actions';
import type { AttachFormState } from '@/server/lots/attach-validation';

const FIELD = 'rounded-md border border-sep px-3 py-2 font-normal';
const LABEL = 'flex flex-col gap-1 text-sm font-semibold text-label';

export function AddPersonForm({ lotId, lotReference }: { lotId: string; lotReference: string }) {
  const t = useTranslations('lots.attach');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<AttachFormState, FormData>(
    addPersonAction,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);
  // Champs CONTRÔLÉS : les valeurs saisies survivent à un ré-affichage d'erreur
  // (React 19 réinitialise les champs non contrôlés après une action de formulaire).
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationality, setNationality] = useState('');
  const [preferredLocale, setPreferredLocale] = useState('fr');
  const [role, setRole] = useState<'OWNER' | 'TENANT'>('OWNER');
  const [delegate, setDelegate] = useState(false);
  const [startDate, setStartDate] = useState(today);

  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<PersonCandidate[] | null>(null);
  const [selected, setSelected] = useState<PersonCandidate | null>(null);
  const [searching, startSearch] = useTransition();

  const err = (f: string) =>
    state.errors?.[f] ? (
      <span className="text-sm text-red">{t(`errors.${state.errors[f]}`)}</span>
    ) : null;

  function runSearch() {
    if (query.trim() === '') return;
    startSearch(async () => setCandidates(await searchPersonsAction(query)));
  }

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="lotId" value={lotId} />
      <input type="hidden" name="existingPersonId" value={selected?.id ?? ''} />

      {/* Dédoublonnage : rattacher une personne déjà connue (cas MRE) */}
      <section className="flex flex-col gap-2 rounded-lg border border-sep p-4">
        <p className="text-sm font-bold text-label">{t('search.label')}</p>
        <p className="text-xs text-label-4">{t('search.hint')}</p>
        {selected ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-indigo-soft px-3 py-2">
            <span className="text-sm font-semibold text-indigo">
              {t('search.selected', { name: selected.name })}
            </span>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-xs font-semibold text-label-3 hover:text-label"
            >
              <X className="size-3" aria-hidden />
              {t('search.clear')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-label-4"
                  aria-hidden
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="w-full rounded-md border border-sep py-2 pe-3 ps-9 text-sm"
                />
              </div>
              <Button type="button" variant="secondary" onClick={runSearch} disabled={searching}>
                {t('search.label')}
              </Button>
            </div>
            {candidates !== null &&
              (candidates.length === 0 ? (
                <p className="text-sm text-label-4">{t('search.none')}</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(c)}
                        className="w-full rounded-md border border-sep px-3 py-2 text-start text-sm hover:bg-bg"
                      >
                        <span className="font-semibold text-label">{c.name}</span>
                        {c.email && <span className="text-label-4"> · {c.email}</span>}
                        {c.country && <span className="text-label-4"> · {c.country}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </>
        )}
      </section>

      {/* Nouvelle personne (si aucune sélection) */}
      {!selected && (
        <section className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm font-bold text-label sm:col-span-2">{t('newTitle')}</p>
          <label className={LABEL}>
            {t('firstName')}
            <input
              name="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={FIELD}
            />
            {err('firstName')}
          </label>
          <label className={LABEL}>
            {t('lastName')}
            <input
              name="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={FIELD}
            />
            {err('lastName')}
          </label>
          <label className={LABEL}>
            {t('email')}
            <input
              name="email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={FIELD}
            />
            {err('email')}
          </label>
          <label className={LABEL}>
            {t('phone')}
            <input
              name="phone"
              type="tel"
              placeholder="+212 6 12 34 56 78"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={FIELD}
            />
            <span className="text-xs font-normal text-label-4">{t('phoneHint')}</span>
          </label>
          <label className={LABEL}>
            {t('country')}
            <input
              name="nationality"
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className={FIELD}
            />
          </label>
          <label className={LABEL}>
            {t('locale')}
            <select
              name="preferredLocale"
              value={preferredLocale}
              onChange={(e) => setPreferredLocale(e.target.value)}
              className={FIELD}
            >
              <option value="fr">{t('localeFr')}</option>
              <option value="ar">{t('localeAr')}</option>
            </select>
            {err('preferredLocale')}
          </label>
        </section>
      )}

      {/* Rattachement */}
      <section className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL}>
          {t('role')}
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'OWNER' | 'TENANT')}
            className={FIELD}
          >
            <option value="OWNER">{t('roleOwner')}</option>
            <option value="TENANT">{t('roleTenant')}</option>
          </select>
          {err('role')}
        </label>
        <label className={LABEL}>
          {t('startDate')}
          <input
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={FIELD}
          />
          {err('startDate')}
        </label>
        {role === 'TENANT' && (
          <label className="flex items-center gap-2 text-sm font-semibold text-label sm:col-span-2">
            <input
              name="delegate"
              type="checkbox"
              checked={delegate}
              onChange={(e) => setDelegate(e.target.checked)}
              className="size-4"
            />
            {t('delegate')}
          </label>
        )}
      </section>

      {state.formError && (
        <p className="rounded-md bg-red-soft px-3 py-2 text-sm text-red">
          {t(`errors.${state.formError}`)}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {t('submit')}
        </Button>
        <Link href={`/lots/${lotId}`}>
          <Button type="button" variant="ghost">
            {t('cancel')}
          </Button>
        </Link>
      </div>

      <p className="text-xs text-label-4">Lot {lotReference}</p>
    </form>
  );
}
