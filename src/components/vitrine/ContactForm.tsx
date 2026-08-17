'use client';

import { useActionState, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { submitContactRequestAction, type ContactActionResult } from '@/server/contact/actions';
import { CONTACT_ROLES } from '@/server/contact/roles';
import { useCalc } from './calc-store';

/**
 * Formulaire de contact (J1, section 8) — LA conversion de la page. Persiste côté serveur AVANT
 * tout e-mail (voir actions.ts). Anti-abus discret : champ-piège invisible (honeypot), aucune
 * vérification pénible. Le nombre de lots est PRÉ-REMPLI depuis le calculateur d'ouverture.
 */
type State = ContactActionResult | null;

export function ContactForm() {
  const t = useTranslations('vitrine.contact');
  const locale = useLocale();
  const calc = useCalc();

  const [state, formAction, pending] = useActionState<State, FormData>(
    (_prev, formData) => submitContactRequestAction(formData),
    null,
  );

  // Pré-remplissage depuis le calculateur (éditable). On ne force que si le visiteur l'a utilisé.
  const [lots, setLots] = useState('');
  useEffect(() => {
    if (calc.touched) setLots(String(calc.lots));
  }, [calc.touched, calc.lots]);

  if (state?.ok) {
    return (
      <div
        className="flex flex-col items-start gap-3 px-6 py-10"
        style={{ border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--white)' }}
      >
        <CheckCircle2 className="size-7" style={{ color: 'var(--accent)' }} aria-hidden />
        <h3 className="v-title text-xl" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {t('okTitle')}
        </h3>
        <p className="max-w-md text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-2)' }}>
          {t('okBody')}
        </p>
      </div>
    );
  }

  const err = state && !state.ok ? state.error : null;
  const errMsg =
    err === 'name_required'
      ? t('errName')
      : err === 'email_invalid'
        ? t('errEmail')
        : err === 'role_invalid'
          ? t('errRole')
          : null;

  const inputCls = 'w-full px-4 py-2.5 text-[0.95rem] outline-none transition-colors focus:bg-white';
  const inputStyle = {
    color: 'var(--ink)',
    border: '1px solid var(--line)',
    borderRadius: '12px',
    background: 'var(--panel)',
  } as const;
  const labelCls = 'mb-1.5 flex items-baseline gap-2 text-sm font-semibold';

  const field = (
    name: string,
    label: string,
    opts: { type?: string; optional?: boolean; value?: string; onChange?: (v: string) => void; inputMode?: 'numeric' } = {},
  ) => (
    <label className="block">
      <span className={labelCls} style={{ color: 'var(--ink)' }}>
        {label}
        {opts.optional && (
          <span className="font-normal" style={{ color: 'var(--ink-3)' }}>
            · {t('optional')}
          </span>
        )}
      </span>
      <input
        name={name}
        type={opts.type ?? 'text'}
        inputMode={opts.inputMode}
        {...(opts.onChange
          ? { value: opts.value ?? '', onChange: (e) => opts.onChange!(e.target.value) }
          : {})}
        className={inputCls}
        style={inputStyle}
      />
    </label>
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Champ-piège : invisible pour l'humain, rempli seulement par les robots. Positionné hors
          écran par propriété LOGIQUE (miroir RTL correct). */}
      <div
        aria-hidden
        className="h-0 w-0 overflow-hidden"
        style={{ position: 'absolute', insetInlineStart: '-9999px' }}
      >
        <label>
          Ne pas remplir
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="locale" value={locale} />

      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', t('fName'))}
        {field('email', t('fEmail'), { type: 'email' })}
        {field('phone', t('fPhone'), { optional: true })}
        {field('city', t('fCity'), { optional: true })}
        {field('residences', t('fResidences'), { optional: true, inputMode: 'numeric' })}
        <label className="block">
          <span className={labelCls} style={{ color: 'var(--ink)' }}>
            {t('fLots')}
            {calc.touched ? (
              <span className="font-normal" style={{ color: 'var(--accent)' }}>
                · {t('prefillNote')}
              </span>
            ) : (
              <span className="font-normal" style={{ color: 'var(--ink-3)' }}>
                · {t('optional')}
              </span>
            )}
          </span>
          <input
            name="lots"
            inputMode="numeric"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelCls} style={{ color: 'var(--ink)' }}>
          {t('fRole')}
        </span>
        <select name="role" defaultValue="" className={inputCls} style={inputStyle}>
          <option value="" disabled>
            {t('rolePlaceholder')}
          </option>
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role${r}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelCls} style={{ color: 'var(--ink)' }}>
          {t('fMessage')}
          <span className="font-normal" style={{ color: 'var(--ink-3)' }}>
            · {t('optional')}
          </span>
        </span>
        <textarea name="message" rows={4} className={inputCls} style={inputStyle} />
      </label>

      {errMsg && (
        <p className="text-sm font-medium" style={{ color: '#c02626' }} role="alert">
          {errMsg}
        </p>
      )}

      <div>
        <button type="submit" className="v-btn" disabled={pending}>
          {pending ? t('sending') : t('submit')}
          {!pending && <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
        </button>
      </div>
    </form>
  );
}
