import { getTranslations } from 'next-intl/server';
import { MessageCircle } from 'lucide-react';
import { ContactForm } from './ContactForm';

/**
 * Section 8 — Le contact (J1), LA conversion de la page. À gauche le discours + un lien WhatsApp
 * direct (piloté par une variable d'environnement, MASQUÉ si absente) ; à droite le formulaire,
 * qui persiste la demande en base avant tout e-mail. Fond #F6F8FA. `id="contact"` = cible du CTA.
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
    <section id="contact" style={{ background: 'var(--panel)', borderBlock: '1px solid var(--line)', scrollMarginBlockStart: '5rem' }}>
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Discours + WhatsApp */}
          <div>
            <p className="v-kicker">{t('kicker')}</p>
            <h2 className="v-title mt-4 text-[clamp(2rem,4vw,3.2rem)]" style={{ color: 'var(--ink)' }}>
              {t('title')}
            </h2>
            <p className="mt-6 max-w-md text-base leading-relaxed sm:text-lg" style={{ color: 'var(--ink-2)' }}>
              {t('lead')}
            </p>

            {wa && (
              <div className="mt-8">
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v-btn-line"
                  style={{ background: 'var(--white)' }}
                >
                  <MessageCircle className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
                  {t('whatsapp')}
                </a>
                <p className="mt-2 text-xs" style={{ color: 'var(--ink-3)' }}>
                  {t('whatsappNote')}
                </p>
              </div>
            )}
          </div>

          {/* Le formulaire — la conversion */}
          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
