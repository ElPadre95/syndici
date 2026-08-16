/**
 * Gabarits d'e-mails (I5) — le contenu vient bien des catalogues, dans la bonne langue, avec
 * les valeurs interpolées. Vérifie fr ET ar (les trois flux couverts), sans réseau.
 */
import { describe, it, expect } from 'vitest';
import {
  magicLinkEmail,
  invitationEmail,
  documentEmail,
  announcementEmail,
} from './templates';

describe('templates e-mail (catalogues fr/ar)', () => {
  it('lien magique : sujet fr + URL dans le corps', async () => {
    const em = await magicLinkEmail('fr', 'https://app.test/x');
    expect(em.subject).toBe('Votre lien de connexion Syndici');
    expect(em.text).toContain('https://app.test/x');
  });

  it('invitation : interpole nom, résidence, lot, code ; localisé ar', async () => {
    const fr = await invitationEmail('fr', {
      name: 'Sara',
      residence: 'Al Firdaous',
      lot: 'A1',
      code: 'ABC12345',
      url: 'https://app.test/fr/invite',
      expires: '31 août 2026',
    });
    expect(fr.subject).toContain('Al Firdaous');
    expect(fr.text).toContain('Sara');
    expect(fr.text).toContain('ABC12345');

    const ar = await invitationEmail('ar', {
      name: 'سارة',
      residence: 'الفردوس',
      lot: 'A1',
      code: 'ABC12345',
      url: 'https://app.test/ar/invite',
      expires: '31 غشت 2026',
    });
    // Sujet arabe (différent du fr) — preuve que la locale est bien prise en compte.
    expect(ar.subject).not.toBe(fr.subject);
    expect(ar.html).toContain('dir="rtl"');
  });

  it('document & actualité : sujet mentionne la résidence, lien présent', async () => {
    const doc = await documentEmail('fr', {
      residence: 'Al Firdaous',
      title: "Règlement de copropriété",
      url: 'https://app.test/fr/proprietaire/documents',
    });
    expect(doc.subject).toContain('Al Firdaous');
    expect(doc.text).toContain('https://app.test/fr/proprietaire/documents');

    const news = await announcementEmail('ar', {
      residence: 'الفردوس',
      title: 'قطع الماء غداً',
      url: 'https://app.test/ar',
    });
    expect(news.text).toContain('قطع الماء غداً');
  });
});
