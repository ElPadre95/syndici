import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { Card } from '@/components/ui/Card';
import { formatMoney } from '@/lib/money';

const NAV_ITEMS = [
  { key: 'dashboard', Icon: LayoutDashboard },
  { key: 'residents', Icon: Users },
  { key: 'payments', Icon: CreditCard },
  { key: 'expenses', Icon: Receipt },
  { key: 'documents', Icon: FileText },
  { key: 'settings', Icon: Settings },
] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const tNav = await getTranslations('nav');
  const tHome = await getTranslations('home');
  const tCommon = await getTranslations('common');

  // 650 MAD, stored as integer centimes and formatted only through the helper.
  const sampleAmount = formatMoney(65000, locale);

  return (
    // flex row: the sidebar sits at the INLINE START — left in fr, right in ar.
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col gap-1 border-e border-sep bg-white pe-3 ps-4 pt-6">
        <div className="mb-6 ps-2">
          <span className="font-serif text-2xl text-label">{tCommon('appName')}</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ key, Icon }, index) => (
            <span
              key={key}
              className={
                // border-s (inline-start) accent proves logical borders flip with dir.
                'flex items-center gap-3 rounded-md border-s-2 py-2 pe-3 ps-3 text-sm font-semibold ' +
                (index === 0
                  ? 'border-indigo bg-indigo-soft text-indigo'
                  : 'border-transparent text-label-3')
              }
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span>{tNav(key)}</span>
            </span>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-8 py-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo">
              {tHome('sectionLabel')}
            </p>
            <h1 className="text-3xl font-extrabold text-label">{tHome('title')}</h1>
            <p className="mt-2 max-w-2xl text-sm text-label-3">{tHome('intro')}</p>
          </div>
          <LocaleSwitcher />
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="mb-2 text-base font-bold text-label">{tHome('layoutHeading')}</h2>
            <p className="text-sm leading-relaxed text-label-3">{tHome('layoutNote')}</p>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo">
              {/* Icon after text: sits at the inline end and points along reading direction. */}
              <span>{tCommon('appName')}</span>
              <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-base font-bold text-label">{tHome('moneyHeading')}</h2>
            <p className="text-sm leading-relaxed text-label-3">{tHome('moneyNote')}</p>
            <dl className="mt-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-label-4">
                {tHome('sampleAmountLabel')}
              </dt>
              <dd className="mt-1 font-serif text-2xl text-label">{sampleAmount}</dd>
            </dl>
          </Card>
        </div>
      </main>
    </div>
  );
}
