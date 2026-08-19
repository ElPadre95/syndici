import {
  LayoutDashboard,
  Building2,
  Wallet,
  Receipt,
  MessagesSquare,
  Settings,
  CreditCard,
  FileBarChart2,
  TriangleAlert,
  Files,
  Eye,
  ScrollText,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

/**
 * Modèle de navigation PARTAGÉ (barre latérale + onglets in-page). Source unique.
 *
 * Le syndic est regroupé en SIX entrées (au lieu de dix-neuf). Chaque groupe ouvre
 * directement sa page la plus utilisée (`href`) — jamais de menu déroulant dans la barre :
 * un écran ouvert dix fois par jour ne doit pas coûter deux clics. À l'intérieur, des ONGLETS
 * (`tabs`) passent d'un écran à l'autre du groupe. Aucun chemin ne change → aucune URL ne casse.
 */
export interface GroupTab {
  href: string;
  /** Clé i18n `app.nav.<key>`. */
  key: string;
}

export interface NavGroup {
  /** Clé i18n `app.groups.<key>`. */
  key: string;
  Icon: LucideIcon;
  /** Page d'atterrissage (la plus utilisée du groupe) — cible du lien de la barre. */
  href: string;
  tabs: GroupTab[];
  /** Compteur de non-lus rattaché à ce groupe (remonte au niveau du groupe). */
  badge?: 'messages';
}

export const STAFF_GROUPS: readonly NavGroup[] = [
  { key: 'dashboard', Icon: LayoutDashboard, href: '/', tabs: [] },
  {
    key: 'copropriete',
    Icon: Building2,
    href: '/lots',
    tabs: [
      { href: '/lots', key: 'lots' },
      { href: '/residents', key: 'residents' },
      { href: '/invitations', key: 'invitations' },
    ],
  },
  {
    key: 'encaissements',
    Icon: Wallet,
    href: '/paiements',
    tabs: [
      { href: '/charges', key: 'charges' },
      { href: '/paiements', key: 'payments' },
      { href: '/relances', key: 'reminders' },
      { href: '/regularisation', key: 'regularisation' },
      // Bilan d'exercice : la clôture comptable annuelle, à côté de la régularisation.
      { href: '/bilan', key: 'annual' },
    ],
  },
  {
    key: 'depenses',
    Icon: Receipt,
    href: '/depenses',
    tabs: [
      { href: '/depenses', key: 'expenses' },
      { href: '/contrats', key: 'contracts' },
      { href: '/travaux', key: 'works' },
      { href: '/budget', key: 'budget' },
    ],
  },
  {
    key: 'vie',
    Icon: MessagesSquare,
    href: '/incidents',
    badge: 'messages',
    tabs: [
      { href: '/incidents', key: 'incidents' },
      { href: '/actualites', key: 'news' },
      { href: '/documents', key: 'documents' },
      { href: '/messagerie', key: 'messages' },
    ],
  },
  {
    key: 'reglages',
    Icon: Settings,
    href: '/reglages',
    tabs: [
      { href: '/reglages', key: 'settings' },
      { href: '/membres', key: 'members' },
      { href: '/residences', key: 'residences' },
    ],
  },
];

/** Navigation PROPRIÉTAIRE (tranche G) — entrées plates, sans groupes ni onglets. */
export interface OwnerItem {
  href: string;
  key: string;
  Icon: LucideIcon;
}

export const OWNER_ITEMS: readonly OwnerItem[] = [
  { href: '/', key: 'dashboard', Icon: LayoutDashboard },
  { href: '/proprietaire/charges', key: 'myCharges', Icon: CreditCard },
  { href: '/proprietaire/releve', key: 'monthly', Icon: FileBarChart2 },
  { href: '/proprietaire/incidents', key: 'incidents', Icon: TriangleAlert },
  { href: '/proprietaire/documents', key: 'ownerDocs', Icon: Files },
  { href: '/proprietaire/transparence', key: 'transparency', Icon: Eye },
  { href: '/proprietaire/journal', key: 'journal', Icon: ScrollText },
  { href: '/proprietaire/profil', key: 'profile', Icon: UserCircle },
];

/** Actif : correspondance exacte pour l'accueil, préfixe sinon. */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Le groupe staff dont un onglet correspond au chemin courant (le tableau de bord n'a pas d'onglet). */
export function activeStaffGroup(pathname: string): NavGroup | undefined {
  return STAFF_GROUPS.find((g) =>
    g.key === 'dashboard' ? pathname === '/' : g.tabs.some((tab) => isActivePath(pathname, tab.href)),
  );
}
