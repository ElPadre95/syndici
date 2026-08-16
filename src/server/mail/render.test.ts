/**
 * Rendu d'e-mail (I5) — enveloppe HTML + version texte. Prouve : échappement HTML, présence
 * du bouton et de son URL en repli texte, sens d'écriture (RTL), et cohérence html/text.
 */
import { describe, it, expect } from 'vitest';
import { renderEmail } from './render';

describe('renderEmail (pur)', () => {
  it('produit html + texte, avec le bouton et son URL en repli', () => {
    const { html, text } = renderEmail({
      heading: 'Bonjour',
      paragraphs: ['Ligne 1', 'Ligne 2'],
      cta: { label: 'Ouvrir', url: 'https://x.test/a?b=1' },
      footer: 'pied',
    });
    expect(html).toContain('Bonjour');
    expect(html).toContain('https://x.test/a?b=1');
    expect(text).toContain('Ligne 1');
    expect(text).toContain('Ouvrir : https://x.test/a?b=1'); // repli texte du bouton
    expect(text).toContain('pied');
  });

  it('échappe le HTML du contenu (pas d’injection)', () => {
    const { html } = renderEmail({ heading: '<script>x</script>', paragraphs: ['a & b'] });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
  });

  it('applique le sens RTL', () => {
    const { html } = renderEmail({ heading: 'مرحبا', paragraphs: ['نص'], dir: 'rtl' });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('text-align:right');
  });
});
