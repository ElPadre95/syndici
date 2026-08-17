/**
 * Captures marketing (J1) — VRAIES captures de l'app, sur le jeu de données MARKETING (aucun
 * nominatif : voir scripts/seed-marketing.ts). ZONE DE CONTENU UNIQUEMENT (pas de barre
 * latérale ni d'en-tête d'app : la navigation évoluera, les captures ne doivent pas dater).
 *
 * Garde-fous : (1) la base DOIT être en état marketing (résidence attendue + e-mails
 * @syndici.com) sinon on échoue franchement ; (2) après rendu, si le texte de la page laisse
 * fuir « .local », « @dev », « @example » ou l'ancienne résidence, la capture est REFUSÉE.
 *
 *   CAPTURE_TARGET=app     → captures de l'app (contenu seul) fr/ar
 *   CAPTURE_TARGET=vitrine → aperçu pleine page de la vitrine fr/ar dans OUT_DIR
 */
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.CAPTURE_BASE ?? 'http://localhost:3000';
const PASSWORD = process.env.MARKETING_PASSWORD ?? 'marketing-capture-2026';
const TARGET = process.env.CAPTURE_TARGET ?? 'app';
const OUT = process.env.OUT_DIR ?? join(process.cwd(), 'public', 'marketing');
const EXPECTED_RESIDENCE = 'Résidence Yasmine';
const FORBIDDEN = /\.local|@dev|@example|firdaous/i;
mkdirSync(OUT, { recursive: true });

const HIDE_DEV = 'nextjs-portal,[data-nextjs-toast],#__next-dev-tools-indicator{display:none!important}';
// Chrome d'application (barre latérale, en-tête COLLANT, bulle de messagerie) : tous portent
// `data-print-hide`. On les masque AVANT la capture — sinon l'en-tête collant et la bulle
// (position: sticky/fixed) débordent sur la boîte de `main` et se retrouvent dans l'image. La
// navigation évoluera : les captures ne doivent montrer QUE la zone de contenu.
const HIDE_CHROME = '[data-print-hide]{display:none!important}';

const SHOTS = [
  { file: 'dashboard', email: 'syndic@syndici.com', path: '' },
  { file: 'transparence', email: 'owner@syndici.com', path: '/proprietaire/transparence' },
  { file: 'paiements', email: 'syndic@syndici.com', path: '/paiements' },
  { file: 'relances', email: 'syndic@syndici.com', path: '/relances' },
  { file: 'depenses', email: 'syndic@syndici.com', path: '/depenses' },
  { file: 'regularisation', email: 'syndic@syndici.com', path: '/regularisation' },
  { file: 'journal', email: 'owner@syndici.com', path: '/proprietaire/journal' },
  ...(process.env.OWNER_LOT_ID
    ? [
        { file: 'compte', email: 'owner@syndici.com', path: `/proprietaire/lots/${process.env.OWNER_LOT_ID}/compte` },
        { file: 'attestation', email: 'owner@syndici.com', path: `/proprietaire/lots/${process.env.OWNER_LOT_ID}/attestation` },
      ]
    : []),
  ...(process.env.RECEIPT_ID
    ? [{ file: 'recu', email: 'owner@syndici.com', path: `/proprietaire/recus/${process.env.RECEIPT_ID}` }]
    : []),
  ...(process.env.WORKS_ID
    ? [{ file: 'travaux', email: 'syndic@syndici.com', path: `/travaux/${process.env.WORKS_ID}` }]
    : []),
];

async function assertMarketingDb() {
  const prisma = new PrismaClient();
  try {
    const res = await prisma.residence.findFirst({ select: { name: true } });
    if (res?.name !== EXPECTED_RESIDENCE) {
      throw new Error(`Base pas en état marketing (résidence = « ${res?.name} », attendu « ${EXPECTED_RESIDENCE} »). Lance scripts/seed-marketing.ts.`);
    }
    const leaks = await prisma.person.count({
      where: { AND: [{ email: { not: null } }, { NOT: { email: { endsWith: '@syndici.com' } } }] },
    });
    if (leaks > 0) throw new Error(`${leaks} e-mail(s) hors @syndici.com en base — état marketing incomplet.`);
  } finally {
    await prisma.$disconnect();
  }
}

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

async function appShot(page, file) {
  await page.addStyleTag({ content: HIDE_DEV + HIDE_CHROME });
  await page.waitForTimeout(700);
  const main = page.locator('main').first();
  // Garde-fou post-rendu : aucune donnée nominative ne doit fuir.
  const text = await main.innerText();
  if (FORBIDDEN.test(text)) {
    throw new Error(`REFUS ${file} : donnée nominative détectée (${(text.match(FORBIDDEN) || [])[0]}).`);
  }
  await main.screenshot({ path: join(OUT, file) }); // ZONE DE CONTENU seule
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
        await page.addStyleTag({ content: HIDE_DEV });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: join(OUT, `vitrine-${locale}.png`), fullPage: true });
        console.log('✔', `vitrine-${locale}.png`);
        await ctx.close();
        continue;
      }
      for (const s of SHOTS) {
        const ctx = await browser.newContext({ viewport: { width: 1320, height: 1200 }, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        await login(page, locale, s.email);
        await page.goto(`${BASE}/${locale}${s.path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        await appShot(page, `${s.file}-${locale}.png`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
}

if (TARGET !== 'vitrine') await assertMarketingDb();
run().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
