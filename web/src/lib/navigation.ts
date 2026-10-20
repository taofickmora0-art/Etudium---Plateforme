import {
  AssignmentsIcon,
  BookOpen01Icon,
  BubbleChatIcon,
  Calendar03Icon,
  Certificate01Icon,
  CourseIcon,
  CreditCardIcon,
  DashboardSquare02Icon,
  FavouriteIcon,
  GiftIcon,
  HelpCircleIcon,
  Home03Icon,
  Megaphone01Icon,
  Notification02Icon,
  Route01Icon,
  Search01Icon,
  Shield01Icon,
  StarIcon,
  StudentsIcon,
  TeachingIcon,
  UserGroupIcon,
  UserIcon,
  UserMultipleIcon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/Icon";
import type { Espace } from "@/lib/auth/permissions";

// Source unique des entrées de menu de l'espace connecté (écran NdAccueil, téléphone NdMobAccueil et NdMobMenu).
export type NavEntry = {
  href: string;
  label: string;
  icon: IconSvgElement;
  /** Marquée seulement sur sa propre page, pas sur ses sous-pages (tableau de bord d'un espace). */
  exact?: boolean;
  /** D'autres pages où l'entrée est marquée aussi (« Mes formations » sous l'onglet Formations). */
  aussi?: string[];
};

// Un seul onglet pour le catalogue et les formations suivies (spec Formations et Événements, §1).
const FORMATIONS: NavEntry = { href: "/formations", label: "Formations", icon: CourseIcon, aussi: ["/mes-formations"] };

// L'Accueil est la communauté (spec du nouvel Accueil, §4) : une page de publication (`/communaute/publications/…`) le
// garde marqué.
const ACCUEIL: NavEntry = { href: "/accueil", label: "Accueil", icon: Home03Icon, aussi: ["/communaute"] };

export const NAV_PRINCIPALE: NavEntry[] = [
  ACCUEIL,
  FORMATIONS,
  { href: "/messages", label: "Messages", icon: BubbleChatIcon },
  { href: "/evenements", label: "Événements", icon: Calendar03Icon },
];

/** Groupe « Mon espace » de la barre latérale. */
export const NAV_MON_ESPACE: NavEntry[] = [
  { href: "/exercices", label: "Exercices", icon: AssignmentsIcon },
  { href: "/parcours", label: "Mes parcours", icon: Route01Icon },
  { href: "/certificats", label: "Certificats", icon: Certificate01Icon },
  { href: "/formations-gratuites", label: "Formations gratuites", icon: GiftIcon },
  { href: "/favoris", label: "Favoris", icon: FavouriteIcon },
  { href: "/abonnement", label: "Mon abonnement", icon: CreditCardIcon },
  { href: "/aide", label: "Aide", icon: HelpCircleIcon },
];

/** Barre du bas du téléphone. « Profil » ouvre la page de menu du téléphone. */
export const NAV_BAS: NavEntry[] = [
  ACCUEIL,
  FORMATIONS,
  { href: "/evenements", label: "Événements", icon: Calendar03Icon },
  { href: "/certificats", label: "Certificats", icon: Certificate01Icon },
  { href: "/menu", label: "Profil", icon: UserIcon },
];

/**
 * Liste de la page « Profil » du téléphone (NdMobMenu), complétée des entrées de la barre latérale
 * que la barre du bas n'a pas (Exercices, formations gratuites…) : sur téléphone, tout reste accessible.
 */
export const NAV_MENU_TELEPHONE: NavEntry[] = [
  { href: "/profil", label: "Mon profil", icon: UserIcon },
  { href: "/abonnement", label: "Mon abonnement", icon: CreditCardIcon },
  { href: "/parcours", label: "Mes parcours", icon: Route01Icon },
  { href: "/exercices", label: "Exercices", icon: AssignmentsIcon },
  { href: "/certificats", label: "Certificats", icon: Certificate01Icon },
  { href: "/formations-gratuites", label: "Formations gratuites", icon: GiftIcon },
  { href: "/favoris", label: "Favoris", icon: FavouriteIcon },
  { href: "/evenements", label: "Événements", icon: Calendar03Icon },
  { href: "/messages", label: "Messages", icon: BubbleChatIcon },
  { href: "/aide", label: "Aide", icon: HelpCircleIcon },
];

/** Raccourcis de l'en-tête du téléphone (la recherche, que la barre du bas n'a pas). */
export const LIENS_ENTETE_TELEPHONE: NavEntry[] = [{ href: "/recherche", label: "Rechercher", icon: Search01Icon }];

// ─── Back-office et espace formateur : chacun son menu (choisi par l'utilisateur, différent du CDC §43) ───────────
const TABLEAU_ADMIN: NavEntry = { href: "/admin", label: "Tableau de bord", icon: DashboardSquare02Icon, exact: true };
const TABLEAU_FORMATEUR: NavEntry = { href: "/formateur", label: "Tableau de bord", icon: DashboardSquare02Icon, exact: true };
const PROFIL: NavEntry = { href: "/menu", label: "Profil", icon: UserIcon };
// Le formateur n'a plus l'espace étudiant (restructuration R1) : sa page « Profil » est dans son espace.
const PROFIL_FORMATEUR: NavEntry = { href: "/formateur/menu", label: "Profil", icon: UserIcon };
const COMMUNAUTE_FORMATEUR: NavEntry = { href: "/formateur/communaute", label: "Communauté", icon: UserGroupIcon };

/** Raccourcis de la page « Profil » du téléphone, côté formateur (restructuration R1). */
export const NAV_MENU_FORMATEUR: NavEntry[] = [
  { href: "/formateur/profil", label: "Mon profil", icon: UserIcon },
  { href: "/formateur/notifications", label: "Notifications", icon: Notification02Icon },
  COMMUNAUTE_FORMATEUR,
  { href: "/formateur/messages", label: "Messages", icon: BubbleChatIcon },
  { href: "/formateur/corrections", label: "Corrections", icon: AssignmentsIcon },
];

/** Un groupe de la barre latérale, avec son titre (« Mon espace ») ou sans. */
export type GroupeNav = { titre?: string; entrees: NavEntry[] };

/** Le menu de chaque espace : nom de la navigation (lecteurs d'écran) et groupes de la barre latérale. */
export const MENUS: Record<Espace, { libelle: string; groupes: GroupeNav[] }> = {
  etudiant: {
    libelle: "Navigation principale",
    groupes: [{ entrees: NAV_PRINCIPALE }, { titre: "Mon espace", entrees: NAV_MON_ESPACE }],
  },
  admin: {
    libelle: "Navigation du back-office",
    groupes: [
      { entrees: [TABLEAU_ADMIN] },
      {
        titre: "Contenus",
        entrees: [
          { href: "/admin/parcours", label: "Parcours", icon: Route01Icon },
          { href: "/admin/formateurs", label: "Formateurs", icon: TeachingIcon },
          { href: "/admin/formations", label: "Formations", icon: BookOpen01Icon },
          { href: "/admin/corrections", label: "Corrections", icon: AssignmentsIcon },
          { href: "/admin/avis", label: "Avis", icon: StarIcon },
          { href: "/admin/sessions", label: "Sessions live", icon: Video01Icon },
        ],
      },
      {
        titre: "Plateforme",
        entrees: [
          { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserMultipleIcon },
          { href: "/admin/messages", label: "Messages", icon: BubbleChatIcon },
          { href: "/admin/annonces", label: "Annonces", icon: Megaphone01Icon },
          { href: "/admin/paiements", label: "Abonnements et paiements", icon: CreditCardIcon },
          { href: "/admin/communaute", label: "Communauté", icon: UserGroupIcon },
          { href: "/admin/moderation", label: "Modération", icon: Shield01Icon },
        ],
      },
    ],
  },
  formateur: {
    libelle: "Navigation de l’espace formateur",
    groupes: [
      { entrees: [TABLEAU_FORMATEUR] },
      {
        titre: "Enseignement",
        entrees: [
          { href: "/formateur/formations", label: "Mes formations", icon: CourseIcon },
          { href: "/formateur/corrections", label: "Corrections", icon: AssignmentsIcon },
          { href: "/formateur/sessions", label: "Sessions live", icon: Video01Icon },
          { href: "/formateur/etudiants", label: "Étudiants", icon: StudentsIcon },
          { href: "/formateur/messages", label: "Messages", icon: BubbleChatIcon },
          COMMUNAUTE_FORMATEUR,
        ],
      },
    ],
  },
};

/** La barre du bas du téléphone, propre à chaque espace ; « Profil » mène toujours au menu du compte. */
export const NAV_BAS_PAR_ESPACE: Record<Espace, NavEntry[]> = {
  etudiant: NAV_BAS,
  admin: [
    TABLEAU_ADMIN,
    { href: "/admin/formations", label: "Formations", icon: BookOpen01Icon },
    { href: "/admin/avis", label: "Avis", icon: StarIcon },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserMultipleIcon },
    PROFIL,
  ],
  formateur: [
    TABLEAU_FORMATEUR,
    { href: "/formateur/formations", label: "Formations", icon: CourseIcon },
    { href: "/formateur/etudiants", label: "Étudiants", icon: StudentsIcon },
    { href: "/formateur/sessions", label: "Sessions live", icon: Video01Icon },
    PROFIL_FORMATEUR,
  ],
};

export { PAGES_A_VENIR, type PageAVenir } from "./pages-a-venir";

/** Une entrée est active sur sa propre page et sur ses sous-pages (« /mes-formations/excel ») ; `exact` : sa page seule. */
export function isActive(pathname: string, href: string, exact = false): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}

/** L'entrée d'un menu est marquée sur sa page, ses sous-pages, et les pages de `aussi` (et leurs sous-pages). */
export function entreeActive(pathname: string, e: NavEntry): boolean {
  return isActive(pathname, e.href, e.exact) || (e.aussi ?? []).some((autre) => isActive(pathname, autre));
}
