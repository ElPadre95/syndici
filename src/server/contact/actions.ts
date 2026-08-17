'use server';

/**
 * Action du formulaire de contact de la vitrine (J1) — la SEULE conversion de la page.
 *
 * Ordre IMPÉRATIF : on PERSISTE la demande en base AVANT le moindre e-mail. La couche mail
 * (I5) ne fait que JOURNALISER tant qu'aucune clé Resend n'est posée ; si l'e-mail était le
 * seul support, chaque lead serait perdu. L'e-mail n'est donc qu'une notification en
 * complément, envoyée après la persistance et tolérante à l'échec.
 *
 * Anti-abus SANS friction (pas de captcha) : (1) un champ-piège (honeypot) invisible que seuls
 * les robots remplissent ; (2) une limite par IP sur une courte fenêtre. Les deux échouent en
 * SILENCE (réponse « ok ») pour ne rien révéler à un envoyeur abusif.
 */
import { headers } from 'next/headers';
import { createContactRequest, countRecentByIp } from './data';
import { isContactRole } from './roles';
import { sendEmail } from '@/server/mail/mailer';
import { contactRequestEmail } from '@/server/mail/templates';
import { normalizeLocale } from '@/server/mail/i18n';

export type ContactActionResult =
  | { ok: true }
  | { ok: false; error: 'name_required' | 'email_invalid' | 'role_invalid' };

/** Fenêtre et plafond de la limite par IP. Généreux pour un humain, serrant pour un robot. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

/** IP cliente à partir des en-têtes de proxy. Best-effort ; jamais affichée. */
function clientIp(h: Headers): string | null {
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim() || null;
  return h.get('x-real-ip') || null;
}

/** Entier positif borné, ou null (les champs nombre de résidences / lots sont facultatifs). */
function parseCount(v: FormDataEntryValue | null, max: number): number | null {
  const n = Number.parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
}

// Validation d'e-mail volontairement permissive : on ne rejette que l'évidemment invalide.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContactRequestAction(
  formData: FormData,
): Promise<ContactActionResult> {
  // (1) Honeypot : champ invisible pour l'humain ; s'il est rempli, c'est un robot. On
  // renvoie « ok » sans rien persister ni notifier.
  if (String(formData.get('website') ?? '').trim() !== '') return { ok: true };

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const roleRaw = String(formData.get('role') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const city = String(formData.get('city') ?? '').trim() || null;
  const message = String(formData.get('message') ?? '').trim().slice(0, 4000) || null;
  const residences = parseCount(formData.get('residences'), 9999);
  const lots = parseCount(formData.get('lots'), 999999);
  const locale = normalizeLocale(String(formData.get('locale') ?? 'fr'));

  if (!name) return { ok: false, error: 'name_required' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'email_invalid' };
  if (!isContactRole(roleRaw)) return { ok: false, error: 'role_invalid' };

  const h = await headers();
  const ip = clientIp(h);
  const userAgent = h.get('user-agent')?.slice(0, 500) ?? null;

  // (2) Limite par IP — échec silencieux au-delà du plafond.
  if (ip) {
    const recent = await countRecentByIp(ip, new Date(Date.now() - RATE_WINDOW_MS));
    if (recent >= RATE_MAX) return { ok: true };
  }

  // PERSISTANCE D'ABORD — le lead est sauvegardé quoi qu'il arrive à l'e-mail.
  await createContactRequest({
    name,
    email,
    phone,
    city,
    residences,
    lots,
    role: roleRaw,
    message,
    locale,
    ip,
    userAgent,
  });

  // NOTIFICATION ENSUITE — complément, jamais bloquant. Un échec d'envoi n'annule pas le lead.
  try {
    const em = await contactRequestEmail('fr', {
      name,
      email,
      phone,
      city,
      residences,
      lots,
      role: roleRaw,
      message,
    });
    const to = process.env.CONTACT_NOTIFY_TO?.trim() || process.env.MAIL_REDIRECT_TO?.trim();
    if (to) await sendEmail({ to, replyTo: email, ...em });
  } catch {
    // On avale : la demande est déjà persistée et consultable côté staff.
  }

  return { ok: true };
}
