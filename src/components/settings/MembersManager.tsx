'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { UserPlus, ShieldCheck, AlertCircle, Check, UserMinus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  inviteMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
} from '@/server/org/actions';
import { ASSIGNABLE_ORG_ROLES } from '@/server/org/members';

export interface MemberRow {
  membershipId: string;
  fullName: string;
  email: string | null;
  role: string;
  status: string;
  hasAccount: boolean;
  endedAt: string | null;
  isProtected: boolean; // dernier administrateur actif : ni retrait ni rétrogradation
  isSelf: boolean;
}

/** Gestion des membres du cabinet (F4) : liste, invitation par e-mail, rôle, retrait. */
export function MembersManager({ rows }: { rows: MemberRow[] }) {
  const t = useTranslations('settings.members');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const run = (
    fd: FormData,
    action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await action(fd);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(t(`err.${res.error}`));
      }
    });
  };

  const invite = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    setError(null);
    start(async () => {
      const res = await inviteMemberAction(fd);
      if (res.ok) {
        form.reset();
        setSaved(true);
        router.refresh();
      } else setError(t(`err.${res.error}`));
    });
  };

  const changeRole = (membershipId: string, role: string) => {
    const fd = new FormData();
    fd.set('membershipId', membershipId);
    fd.set('role', role);
    run(fd, changeMemberRoleAction);
  };
  const remove = (membershipId: string) => {
    const fd = new FormData();
    fd.set('membershipId', membershipId);
    run(fd, removeMemberAction);
  };

  const active = rows.filter((r) => r.status === 'ACTIVE');
  const ended = rows.filter((r) => r.status !== 'ACTIVE');

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-label">
            <ShieldCheck className="size-4 text-indigo" aria-hidden />
            {t('title')}
          </h2>
          <p className="mt-1 text-xs text-label-3">{t('subtitle')}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md bg-orange-soft px-3 py-2 text-sm font-semibold text-orange">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}
        {saved && !error && (
          <div className="flex items-center gap-1 text-sm font-semibold text-green">
            <Check className="size-4" aria-hidden />
            {t('saved')}
          </div>
        )}

        {/* Membres actifs */}
        <ul className="flex flex-col divide-y divide-sep">
          {active.map((m) => (
            <li key={m.membershipId} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-label">
                  {m.fullName}
                  {m.isSelf && <span className="ms-2 text-xs text-label-4">{t('you')}</span>}
                </p>
                <p className="text-xs text-label-4">
                  {m.email ?? '—'}
                  {!m.hasAccount && <span className="ms-2">· {t('noAccount')}</span>}
                </p>
              </div>

              <select
                value={ASSIGNABLE_ORG_ROLES.includes(m.role as never) ? m.role : 'MANAGER'}
                disabled={pending || m.isProtected}
                onChange={(e) => changeRole(m.membershipId, e.target.value)}
                className="rounded-md border border-sep px-2 py-1 text-sm disabled:opacity-50"
                aria-label={t('roleLabel')}
              >
                {ASSIGNABLE_ORG_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}`)}
                  </option>
                ))}
              </select>

              {m.isProtected ? (
                <span
                  className="rounded-full bg-indigo-soft px-2 py-1 text-xs font-bold text-indigo"
                  title={t('lastAdminHint')}
                >
                  {t('lastAdmin')}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => remove(m.membershipId)}
                  disabled={pending}
                  className="text-xs text-red"
                >
                  <UserMinus className="size-4" aria-hidden />
                  {t('remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>

        {/* Historique : accès retirés (jamais supprimés) */}
        {ended.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold uppercase tracking-wide text-label-4">
              {t('endedTitle')}
            </p>
            <ul className="flex flex-col divide-y divide-sep">
              {ended.map((m) => (
                <li
                  key={m.membershipId}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm text-label-4"
                >
                  <span className="flex-1 font-semibold line-through">{m.fullName}</span>
                  <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-bold">
                    {t(`status.${m.status}`)}
                    {m.endedAt ? ` · ${m.endedAt.slice(0, 10)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Inviter un membre par e-mail */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite(e.currentTarget);
          }}
          className="flex flex-col gap-3 rounded-md bg-bg p-3"
        >
          <p className="text-sm font-bold text-label">{t('inviteTitle')}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              name="firstName"
              required
              placeholder={t('firstName')}
              className="rounded-md border border-sep px-3 py-2 text-sm"
            />
            <input
              name="lastName"
              required
              placeholder={t('lastName')}
              className="rounded-md border border-sep px-3 py-2 text-sm"
            />
            <input
              name="email"
              type="email"
              required
              placeholder={t('email')}
              className="rounded-md border border-sep px-3 py-2 text-sm sm:col-span-2"
            />
            <select
              name="role"
              defaultValue="MANAGER"
              className="rounded-md border border-sep px-3 py-2 text-sm"
              aria-label={t('roleLabel')}
            >
              {ASSIGNABLE_ORG_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role.${r}`)}
                </option>
              ))}
            </select>
            <div className="flex items-center">
              <Button type="submit" variant="secondary" disabled={pending}>
                <UserPlus className="size-4" aria-hidden />
                {t('invite')}
              </Button>
            </div>
          </div>
          <p className="text-xs text-label-4">{t('inviteHint')}</p>
        </form>
      </div>
    </Card>
  );
}
