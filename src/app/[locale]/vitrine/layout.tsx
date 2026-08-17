import { Archivo, Inter, IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google';
import '@/styles/vitrine.css';

/**
 * Coquille de la vitrine publique (J1), direction « L'INSTRUMENT ». Titres Archivo (700),
 * corps Inter, chiffres/références IBM Plex Mono (tabulaires), arabe IBM Plex Sans Arabic.
 * Aucune authentification : cette coquille est publique.
 */
const fontTitle = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});
const fontBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});
const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});
const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
});

export default function VitrineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`vitrine ${fontTitle.variable} ${fontBody.variable} ${fontMono.variable} ${fontArabic.variable}`}
    >
      {children}
    </div>
  );
}
