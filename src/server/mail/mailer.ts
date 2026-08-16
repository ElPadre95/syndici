/**
 * Canal d'envoi d'e-mails (I5) — abstrait comme le stockage (`storeFile`) et le paiement
 * (`MockProvider`). Deux implémentations derrière une seule interface `Mailer` :
 *
 *   - `LogMailer` (développement) : n'envoie RIEN, journalise seulement. C'est le défaut
 *     partout où aucune clé n'est configurée, et TOUJOURS en dehors de la production.
 *   - `ResendMailer` (production) : envoie via l'API HTTP de Resend.
 *
 * Le fournisseur, l'expéditeur et l'éventuelle redirection de test sont choisis par
 * VARIABLES D'ENVIRONNEMENT (jamais codés en dur) : passer à un vrai domaine = changer
 * `MAIL_FROM`, sans toucher au code. Tant qu'on est en phase interne, `MAIL_REDIRECT_TO`
 * force TOUTES les destinations vers l'adresse vérifiée (rien ne part vers les résidents).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type SendResult =
  | { ok: true; skipped: true } // journalisé, non envoyé (dev)
  | { ok: true; id: string | null; redirectedTo: string | null } // envoyé (prod)
  | { ok: false; error: string };

export interface Mailer {
  send(msg: EmailMessage): Promise<SendResult>;
}

// ── Configuration (PURE, testable) ─────────────────────────────────────────────

export interface MailEnv {
  NODE_ENV?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_REDIRECT_TO?: string;
}

export interface MailConfig {
  mode: 'send' | 'log';
  from: string;
  apiKey: string | null;
  redirectTo: string | null;
}

/** Expéditeur de test par défaut de Resend : fonctionne SANS domaine ni DNS. */
export const DEFAULT_MAIL_FROM = 'Syndici <onboarding@resend.dev>';

/**
 * Décide, à partir de l'environnement, s'il faut ENVOYER (Resend) ou seulement JOURNALISER.
 * On n'envoie qu'en production ET si une clé est présente ; sinon on journalise (le dev
 * n'envoie jamais). Fonction PURE.
 */
export function resolveMailConfig(env: MailEnv): MailConfig {
  const apiKey = env.RESEND_API_KEY?.trim() || null;
  const isProd = env.NODE_ENV === 'production';
  return {
    mode: isProd && apiKey ? 'send' : 'log',
    from: env.MAIL_FROM?.trim() || DEFAULT_MAIL_FROM,
    apiKey,
    redirectTo: env.MAIL_REDIRECT_TO?.trim() || null,
  };
}

/** Applique la redirection de test : renvoie la destination réelle (override si configuré). */
export function effectiveRecipient(to: string, redirectTo: string | null): string {
  return redirectTo ?? to;
}

// ── Implémentations ────────────────────────────────────────────────────────────

/** N'envoie rien : journalise l'e-mail (sujet + destinataire). Défaut en développement. */
export class LogMailer implements Mailer {
  constructor(private readonly label = 'dev') {}
  async send(msg: EmailMessage): Promise<SendResult> {
    // Journalisation lisible — la preuve que la chaîne fonctionne, sans rien envoyer.
    console.info(`[mail:${this.label}] (non envoyé) → ${msg.to} | ${msg.subject}\n${msg.text}`);
    return { ok: true, skipped: true };
  }
}

/** Envoie via l'API HTTP de Resend. `redirectTo` force la destination (phase interne). */
export class ResendMailer implements Mailer {
  constructor(
    private readonly cfg: { apiKey: string; from: string; redirectTo: string | null },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(msg: EmailMessage): Promise<SendResult> {
    const to = effectiveRecipient(msg.to, this.cfg.redirectTo);
    const redirected = this.cfg.redirectTo ? this.cfg.redirectTo : null;
    // Si redirigé, on rappelle le destinataire visé en tête du corps (traçabilité interne).
    const note = redirected ? `[destinataire visé : ${msg.to}]\n\n` : '';
    try {
      const res = await this.fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.cfg.from,
          to,
          subject: redirected ? `[test] ${msg.subject}` : msg.subject,
          html: note ? `<p style="color:#94a3b8">${note}</p>${msg.html}` : msg.html,
          text: note + msg.text,
          ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return { ok: false, error: `resend ${res.status}: ${body.slice(0, 200)}` };
      }
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, id: data.id ?? null, redirectedTo: redirected };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network error' };
    }
  }
}

// ── Sélecteur ────────────────────────────────────────────────────────────────

let _mailer: Mailer | null = null;

/** Le mailer du runtime, choisi selon l'environnement (mémoïsé). */
export function getMailer(): Mailer {
  if (_mailer) return _mailer;
  const cfg = resolveMailConfig(process.env);
  _mailer =
    cfg.mode === 'send' && cfg.apiKey
      ? new ResendMailer({ apiKey: cfg.apiKey, from: cfg.from, redirectTo: cfg.redirectTo })
      : new LogMailer(process.env.NODE_ENV === 'production' ? 'prod-nokey' : 'dev');
  return _mailer;
}

/** Envoie un e-mail via le mailer courant. Ne jette jamais : renvoie un `SendResult`. */
export function sendEmail(msg: EmailMessage): Promise<SendResult> {
  return getMailer().send(msg);
}
