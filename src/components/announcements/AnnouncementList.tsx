import { getLocale, getTranslations } from 'next-intl/server';
import { Info, Hammer, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AnnouncementView } from '@/server/announcements/data';

const TYPE_STYLE: Record<string, { Icon: typeof Info; tone: string }> = {
  INFORMATION: { Icon: Info, tone: 'bg-bg text-label-3' },
  TRAVAUX: { Icon: Hammer, tone: 'bg-orange-soft text-orange' },
  URGENT: { Icon: AlertTriangle, tone: 'bg-red-soft text-red' },
  REUNION: { Icon: Users, tone: 'bg-indigo-soft text-indigo' },
  TERMINE: { Icon: Info, tone: 'bg-green-soft text-green' },
};

/** Liste d'actualités (E3). `showAudience` : le staff voit la cible ; le résident non. */
export async function AnnouncementList({
  items,
  showAudience = false,
}: {
  items: AnnouncementView[];
  showAudience?: boolean;
}) {
  const t = await getTranslations('announcements');
  const locale = await getLocale();
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <ul className="flex flex-col gap-3">
      {items.map((a) => {
        const style = TYPE_STYLE[a.type] ?? TYPE_STYLE.INFORMATION!;
        const Icon = style.Icon;
        return (
          <li key={a.id} className="rounded-lg border border-sep bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold',
                  style.tone,
                )}
              >
                <Icon className="size-3" aria-hidden />
                {t(`type.${a.type}`)}
              </span>
              {showAudience && (
                <span className="rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-label-3">
                  {t(`audience.${a.audience}`)}
                </span>
              )}
              <span className="ms-auto text-xs text-label-4">
                {fmt.format(new Date(a.publishedAt))}
              </span>
            </div>
            <h3 className="mt-2 text-base font-bold text-label">{a.title}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-label-3">
              {a.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
