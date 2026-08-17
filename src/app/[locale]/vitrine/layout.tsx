import {
  Archivo,
  Inter,
  IBM_Plex_Mono,
  IBM_Plex_Sans_Arabic,
  Caveat,
  Aref_Ruqaa,
} from 'next/font/google';
import '@/styles/vitrine.css';

/**
 * Coquille de la vitrine publique (J). Corps Inter, chiffres/références IBM Plex Mono, arabe
 * IBM Plex Sans Arabic. Titres MANUSCRITS : Caveat (700) pour le français, Aref Ruqaa (ruq'ah)
 * pour l'arabe — chaque langue a son geste, aucune n'est traitée en seconde classe. Archivo
 * reste chargé pour les sections encore en direction « instrument » (migration progressive).
 * Aucune authentification : cette coquille est publique.
 */
const fontHand = Caveat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-caveat',
  display: 'swap',
});
const fontHandArabic = Aref_Ruqaa({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-aref',
  display: 'swap',
});
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
      className={`vitrine ${fontHand.variable} ${fontHandArabic.variable} ${fontTitle.variable} ${fontBody.variable} ${fontMono.variable} ${fontArabic.variable}`}
    >
      {children}
    </div>
  );
}
