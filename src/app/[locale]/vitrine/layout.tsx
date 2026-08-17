import { Fraunces, IBM_Plex_Mono } from 'next/font/google';
import '@/styles/vitrine.css';

/**
 * Coquille de la vitrine publique (J1). Charge les fontes propres à la vitrine — Fraunces
 * (titres, allure éditoriale/officielle) et IBM Plex Mono (chiffres alignés, façon reçu) —
 * et pose le décor « papier ». Aucune authentification : cette coquille est publique.
 */
const fontDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export default function VitrineLayout({ children }: { children: React.ReactNode }) {
  return <div className={`vitrine ${fontDisplay.variable} ${fontMono.variable}`}>{children}</div>;
}
