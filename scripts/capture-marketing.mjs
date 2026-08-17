/**
 * Captures marketing (J1) — VRAIES captures de l'app, sur le jeu de données MARKETING (aucun
 * nominatif : voir scripts/seed-marketing.ts). Enregistre des PNG nets (retina) dans
 * `public/marketing/`. Pré-requis : serveur dev lancé + `tsx scripts/seed-marketing.ts` exécuté.
 *
 *   CAPTURE_TARGET=app     → captures de l'app (dashboard, transparence…) fr/ar
 *   CAPTURE_TARGET=vitrine → aperçu de la vitrine fr/ar dans OUT_DIR (jugement)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.CAPTURE_BASE ?? 'http://localhost:3000';
const PASSWORD = process.env.MARKETING_PASSWORD ?? 'marketing-capture-2026';
const TARGET = process.env.CAPTURE_TARGET ?? 'app';
const OUT = process.env.OUT_DIR ?? join(process.cwd(), 'public', 'marketing');
mkdirSync(OUT, { recursive: true });

const HIDE_DEV = 'nextjs-portal,[data-nextjs-toast],#__next-dev-tools-indicator{display:none!important}';

// Écrans à capturer : { fichier, compte, chemin }. Le tableau de bord est à la racine. Les
// écrans avec identifiant (compte de lot, chantier) ne sont capturés que si l'id est fourni.
const SHOTS = [
  { file: 'dashboard', email: 'syndic@syndici.com', path: '' },
  { file: 'transparence', email: 'owner@syndici.com', path: '/proprietaire/transparence' },
  { file: 'paiements', email: 'syndic@syndici.com', path: '/paiements' },
  { file: 'relances', email: 'syndic@syndici.com', path: '/relances' },
  { file: 'depenses', email: 'syndic@syndici.com', path: '/depenses' },
  ...(process.env.OWNER_LOT_ID
    ? [{ file: 'compte', email: 'owner@syndici.com', path: `/proprietaire/lots/${process.env.OWNER_LOT_ID}/compte` }]
    : []),
  ...(process.env.WORKS_ID
    ? [{ file: 'travaux', email: 'syndic@syndici.com', path: `/travaux/${process.env.WORKS_ID}` }]
    : []),
];

async function login(page, locale, email) {
  await page.goto(`${BASE}/${locale}/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
}

async function shot(page, file, opts = {}) {
  await page.addStyleTag({ content: HIDE_DEV });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, file), ...opts });
  console.log('✔', join(OUT, file));
}

async function run() {
  const browser = await chromium.launch();
  try {
    for (const locale of ['fr', 'ar']) {
      if (TARGET === 'vitrine') {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/${locale}/vitrine`, { waitUntil: 'networkidle' });
        // Parcourt la page pour déclencher le chargement paresseux (next/image) avant la capture.
        await page.evaluate(
          () =>
            new Promise((res) => {
              let y = 0;
              const step = () => {
                window.scrollBy(0, 700);
                y += 700;
                if (y < document.body.scrollHeight) setTimeout(step, 110);
                else {
                  window.scrollTo(0, 0);
                  setTimeout(res, 500);
                }
              };
              step();
            }),
        );
        await page.waitForTimeout(1000);
        await shot(page, `vitrine-${locale}.png`, { fullPage: true });
        await ctx.close();
        continue;
      }
      for (const s of SHOTS) {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await login(page, locale, s.email);
        await page.goto(`${BASE}/${locale}${s.path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        await shot(page, `${s.file}-${locale}.png`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
