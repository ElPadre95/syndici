/**
 * Notification e-mail des résidents (I5). Énumère l'annuaire de la résidence (via la couche
 * d'accès person-access, seule autorisée à lire Person), filtre par audience et adresse
 * présente, dédoublonne par e-mail, puis envoie à chacun dans SA langue. Robuste : un échec
 * unitaire n'interrompt pas les autres (Promise.allSettled) ; en dev tout est journalisé.
 */
import { prismaExecutor } from '@/server/db/sql';
import { listResidentDirectory } from '@/server/auth/person-access';
import { sendEmail } from './mailer';
import type { RenderedEmail } from './templates';
import type { ActiveContext } from '@/server/auth/context';

export type NotifyAudience = 'ALL' | 'OWNERS' | 'TENANTS';

/** Envoie un e-mail (construit par langue) à chaque résident concerné. Renvoie le nombre d'envois. */
export async function notifyResidence(
  ctx: ActiveContext,
  opts: { audience: NotifyAudience; build: (locale: string) => Promise<RenderedEmail> },
): Promise<{ recipients: number; sent: number }> {
  const directory = await listResidentDirectory(prismaExecutor(), ctx);
  const seen = new Set<string>();
  const targets: { email: string; locale: string }[] = [];
  for (const p of directory) {
    if (!p.email || seen.has(p.email)) continue;
    const roles = new Set(p.lots.filter((l) => l.active).map((l) => l.role));
    const match =
      opts.audience === 'ALL' ||
      (opts.audience === 'OWNERS' && roles.has('OWNER')) ||
      (opts.audience === 'TENANTS' && roles.has('TENANT'));
    if (!match) continue;
    seen.add(p.email);
    targets.push({ email: p.email, locale: p.preferredLocale });
  }

  const results = await Promise.allSettled(
    targets.map(async (t) => {
      const em = await opts.build(t.locale);
      return sendEmail({ to: t.email, ...em });
    }),
  );
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  return { recipients: targets.length, sent };
}
