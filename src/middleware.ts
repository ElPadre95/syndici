import createIntlMiddleware from 'next-intl/middleware';
import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { routing } from '@/i18n/routing';
import { authConfigBase } from '@/auth.config';

/**
 * Middleware : i18n (next-intl) + garde d'authentification (§1).
 *
 * Toute route de gestion exige une session. Les seules routes publiques sous
 * `[locale]` sont la connexion et l'activation par invitation. Un visiteur non
 * authentifié est redirigé vers `/<locale>/sign-in?callbackUrl=<chemin demandé>`
 * afin de revenir à la page voulue après connexion. La garde ne fait que vérifier
 * la PRÉSENCE d'une session valide (JWT décodé au runtime edge) ; l'autorisation
 * fine (rôle par résidence) reste appliquée côté serveur par la couche dédiée.
 */
const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfigBase);

// `vitrine` = la page publique servie à la RACINE pour un visiteur anonyme (voir plus bas).
const PUBLIC_SEGMENTS = new Set(['sign-in', 'invite', 'vitrine']);
const locales = routing.locales as readonly string[];

export default auth((req) => {
  const { nextUrl } = req;
  const segments = nextUrl.pathname.split('/').filter(Boolean);
  const hasLocale = segments.length > 0 && locales.includes(segments[0]!);
  const locale = hasLocale ? segments[0]! : routing.defaultLocale;
  const firstAfterLocale = hasLocale ? segments[1] : segments[0];
  const isRoot = firstAfterLocale === undefined; // « /fr », « /ar » (ou « / »)
  const isPublic = firstAfterLocale !== undefined && PUBLIC_SEGMENTS.has(firstAfterLocale);

  // RACINE PUBLIQUE : « /<locale> » branche selon la session. Visiteur anonyme → la vitrine
  // est servie par RÉÉCRITURE (l'URL reste « /<locale> ») ; utilisateur connecté → il poursuit
  // vers son tableau de bord (couche (app), inchangée). Toutes les autres URL restent gardées.
  if (isRoot && hasLocale && !req.auth) {
    const url = nextUrl.clone();
    url.pathname = `/${locale}/vitrine`;
    return NextResponse.rewrite(url);
  }

  if (!isRoot && !isPublic && !req.auth) {
    const signInUrl = new URL(`/${locale}/sign-in`, nextUrl.origin);
    signInUrl.searchParams.set('callbackUrl', nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  // Tout sauf les routes API, les internes Next et les fichiers avec extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
