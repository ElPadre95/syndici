/**
 * Capture de VRAIES captures d'écran de l'application (compte de démo) pour la vitrine (J1).
 * Se connecte au serveur de dev, navigue, et enregistre des PNG nets (retina) dans
 * `public/marketing/`. Lancer le serveur dev d'abord, puis : `node scripts/capture-marketing.mjs`.
 *
 * CAPTURE_TARGET=app     → captures de l'app (transparence fr/ar) dans public/marketing/
 * CAPTURE_TARGET=vitrine → aperçu de la vitrine (fr/ar) dans le dossier OUT_DIR (jugement)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.CAPTURE_BASE ?? 'http://localhost:3000';
const EMAIL = process.env.CAPTURE_EMAIL ?? 'owner@dev.local';
const PASSWORD = process.env.CAPTURE_PASSWORD ?? 'dev-owner-2026';
const TARGET = process.env.CAPTURE_TARGET ?? 'app';
const OUT = process.env.OUT_DIR ?? join(process.cwd(), 'public', 'marketing');
mkdirSync(OUT, { recursive: true });

const HIDE_DEV = 'nextjs-portal,[data-nextjs-toast],#__next-dev-tools-indicator{display:none!important}';

async function login(page, locale) {
  await page.goto(`${BASE}/${locale}/sign-in`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
}

async function shot(page, path, opts = {}) {
  await page.addStyleTag({ content: HIDE_DEV });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, path), ...opts });
  console.log('✔', join(OUT, path));
}

async function run() {
  const browser = await chromium.launch();
  try {
    for (const locale of ['fr', 'ar']) {
      const ctx = await browser.newContext({
        viewport: { width: 1440, height: 960 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();

      if (TARGET === 'vitrine') {
        await page.goto(`${BASE}/${locale}/vitrine`, { waitUntil: 'networkidle' });
        await shot(page, `vitrine-${locale}.png`, { fullPage: true });
      } else {
        await login(page, locale);
        await page.goto(`${BASE}/${locale}/proprietaire/transparence`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        await shot(page, `transparence-${locale}.png`);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
