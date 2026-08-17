import { getTranslations } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { ContactForm } from './ContactForm';

/**
 * Section 8 — Le contact (J, direction manuscrite), LA conversion de la page. À gauche le
 * discours + un lien WhatsApp direct (piloté par une variable d'environnement, MASQUÉ si
 * absente) ; à droite le formulaire, qui persiste la demande en base avant tout e-mail. Fond
 * panneau léger. `id="contact"` = cible de tous les CTA.
 */

/** Numéro WhatsApp de contact, chiffres seuls (format international sans « + »), ou null. */
function whatsappDigits(): string | null {
  const raw = process.env.CONTACT_WHATSAPP?.replace(/\D/g, '') ?? '';
  return raw.length >= 8 ? raw : null;
}

export async function Contact() {
  const t = await getTranslations('vitrine.contact');
  const wa = whatsappDigits();

  return (
    <section id="contact" style={{ background: 'var(--panel)', scrollMarginBlockStart: '5rem' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Discours + WhatsApp */}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
              {t('kicker')}
            </p>
            <h2 className="v-hand mt-3 text-[clamp(2.2rem,4.4vw,3.4rem)]" style={{ color: 'var(--ink)' }}>
              {t('title')}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed" style={{ color: 'var(--ink-2)' }}>
              <span className="v-leadin">{t('lead')}</span>
            </p>

            {wa && (
              <div className="mt-8">
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-base font-bold"
                  style={{ background: 'var(--white)', color: 'var(--ink)', boxShadow: '0 8px 24px -12px rgba(11,18,32,.22)' }}
                >
                  <MessageCircle className="size-5" style={{ color: 'var(--accent)' }} aria-hidden />
                  {t('whatsapp')}
                </a>
                <p className="mt-2 text-sm" style={{ color: 'var(--ink-3)' }}>
                  {t('whatsappNote')}
                </p>
              </div>
            )}
          </div>

          {/* Le formulaire — la conversion (persistance en base avant tout e-mail) */}
          <div className="v-float p-7 lg:p-9" style={{ background: 'var(--white)' }}>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
