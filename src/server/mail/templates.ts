/**
 * Gabarits d'e-mails (I5) — un par flux couvert : lien magique, invitation, nouveau document,
 * nouvelle actualité. Chacun assemble le contenu (catalogue `mail`, dans la langue voulue) et
 * l'enveloppe HTML (`renderEmail`), et renvoie `{ subject, html, text }` prêt pour `sendEmail`.
 */
import { renderEmail } from './render';
import { mailT, normalizeLocale } from './i18n';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const dirOf = (locale: string): 'ltr' | 'rtl' => (normalizeLocale(locale) === 'ar' ? 'rtl' : 'ltr');

/** Lien magique de connexion. `url` est fourni par Auth.js. */
export async function magicLinkEmail(locale: string, url: string): Promise<RenderedEmail> {
  const t = await mailT(locale);
  const { html, text } = renderEmail({
    heading: t('magicLink.heading'),
    paragraphs: [t('magicLink.intro')],
    cta: { label: t('magicLink.cta'), url },
    footer: `${t('magicLink.ignore')}\n${t('footer')}`,
    dir: dirOf(locale),
  });
  return { subject: t('magicLink.subject'), html, text };
}

/** Invitation d'un résident (code + lien d'activation). */
export async function invitationEmail(
  locale: string,
  d: { name: string; residence: string; lot: string; code: string; url: string; expires: string },
): Promise<RenderedEmail> {
  const t = await mailT(locale);
  const { html, text } = renderEmail({
    heading: t('invite.heading'),
    paragraphs: [
      t('invite.intro', { name: d.name, residence: d.residence, lot: d.lot }),
      t('invite.code', { code: d.code }),
      t('invite.expires', { date: d.expires }),
    ],
    cta: { label: t('invite.cta'), url: d.url },
    footer: t('footer'),
    dir: dirOf(locale),
  });
  return { subject: t('invite.subject', { residence: d.residence }), html, text };
}

/** Notification d'un nouveau document de la résidence. */
export async function documentEmail(
  locale: string,
  d: { residence: string; title: string; url: string },
): Promise<RenderedEmail> {
  const t = await mailT(locale);
  const { html, text } = renderEmail({
    heading: t('document.heading'),
    paragraphs: [t('document.intro', { residence: d.residence, title: d.title })],
    cta: { label: t('document.cta'), url: d.url },
    footer: t('footer'),
    dir: dirOf(locale),
  });
  return { subject: t('document.subject', { residence: d.residence }), html, text };
}

/** Notification d'une nouvelle actualité de la résidence. */
export async function announcementEmail(
  locale: string,
  d: { residence: string; title: string; url: string },
): Promise<RenderedEmail> {
  const t = await mailT(locale);
  const { html, text } = renderEmail({
    heading: t('announcement.heading', { residence: d.residence }),
    paragraphs: [t('announcement.intro', { title: d.title })],
    cta: { label: t('announcement.cta'), url: d.url },
    footer: t('footer'),
    dir: dirOf(locale),
  });
  return { subject: t('announcement.subject', { residence: d.residence }), html, text };
}
