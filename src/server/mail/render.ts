/**
 * Rendu d'un e-mail (I5) — enveloppe HTML minimale, compatible clients mail (styles inline,
 * une seule colonne). Fonction PURE : le CONTENU (sujet, titre, paragraphes, bouton) vient des
 * catalogues fr/ar ; ici on ne fait que la mise en forme et la version texte (fallback).
 */

export interface EmailParts {
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footer?: string;
  dir?: 'ltr' | 'rtl';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Construit `{ html, text }` à partir des morceaux traduits. */
export function renderEmail(parts: EmailParts): { html: string; text: string } {
  const dir = parts.dir ?? 'ltr';
  const align = dir === 'rtl' ? 'right' : 'left';
  const paras = parts.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#0e1a2b">${escapeHtml(p)}</p>`,
    )
    .join('');
  const cta = parts.cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(parts.cta.url)}" style="display:inline-block;background:#4f6ef7;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px">${escapeHtml(parts.cta.label)}</a></p>`
    : '';
  const ctaFallback = parts.cta
    ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#64748b;word-break:break-all">${escapeHtml(parts.cta.url)}</p>`
    : '';
  const footer = parts.footer
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#94a3b8">${escapeHtml(parts.footer)}</p>`
    : '';

  const html = `<!doctype html><html dir="${dir}"><body style="margin:0;background:#f4f5f8;padding:24px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto">
    <tr><td style="background:#ffffff;border:1px solid #e5e8ee;border-radius:16px;padding:32px;text-align:${align}">
      <p style="margin:0 0 20px;font-size:13px;font-weight:800;letter-spacing:0.04em;color:#4f6ef7;text-transform:uppercase">Syndici</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0e1a2b">${escapeHtml(parts.heading)}</h1>
      ${paras}${cta}${ctaFallback}${footer}
    </td></tr>
  </table>
</body></html>`;

  const text = [
    parts.heading,
    '',
    ...parts.paragraphs,
    ...(parts.cta ? ['', `${parts.cta.label} : ${parts.cta.url}`] : []),
    ...(parts.footer ? ['', parts.footer] : []),
  ].join('\n');

  return { html, text };
}
