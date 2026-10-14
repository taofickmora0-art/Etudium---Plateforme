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
};

export const NAV_PRINCIPALE: NavEntry[] = [
  { href: "/accueil", label: "Accueil", icon: Home03Icon },
  { href: "/evenements", label: "Événements", icon: Calendar03Icon },
  { href: "/communaute", label: "Communauté", icon: UserGroupIcon },
  { href: "/messages", label: "Messages", icon: BubbleChatIcon },
];

/** Groupe « Mon espace » de la barre latérale. */
export const NAV_MON_ESPACE: NavEntry[] = [
  { href: "/mes-formations", label: "Mes formations", icon: CourseIcon },
  { href: "/exercices", label: "Exercices", icon: AssignmentsIcon },
  { href: "/parcours", label: "Mes parcours", icon: Route01Icon },
  { href: "/certificats", label: "Certificats", icon: Certificate01Icon },
  { href: "/formations", label: "Toutes les formations", icon: BookOpen01Icon },
  { href: "/formations-gratuites", label: "Formations gratuites", icon: GiftIcon },
  { href: "/favoris", label: "Favoris", icon: FavouriteIcon },
  { href: "/abonnement", label: "Mon abonnement", icon: CreditCardIcon },
  { href: "/aide", label: "Aide", icon: HelpCircleIcon },
];

/** Barre du bas du téléphone. « Profil » ouvre la page de menu du téléphone. */
export const NAV_BAS: NavEntry[] = [
  { href: "/accueil", label: "Accueil", icon: Home03Icon },
  { href: "/mes-formations", label: "Formations", icon: CourseIcon },
  { href: "/communaute", label: "Communauté", icon: UserGroupIcon },
  { href: "/certificats", label: "Certificats", icon: Certificate01Icon },
  { href: "/menu", label: "Profil", icon: UserIcon },
];

/**
 * Liste de la page « Profil » du téléphone (NdMobMenu), complétée des entrées de la barre latérale
 * que la barre du bas n'a pas (Exercices, catalogue, formations gratuites) : sur téléphone, tout reste accessible.
 */
export const NAV_MENU_TELEPHONE: NavEntry[] = [
  { href: "/profil", label: "Mon profil", icon: UserIcon },
  { href: "/abonnement", label: "Mon abonnement", icon: CreditCardIcon },
  { href: "/parcours", label: "Mes parcours", icon: Route01Icon },
  { href: "/exercices", label: "Exercices", icon: AssignmentsIcon },
  { href: "/certificats", label: "Certificats", icon: Certificate01Icon },
  { href: "/formations", label: "Toutes les formations", icon: BookOpen01Icon },
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
          { href: "/admin/avis", label: "Avis", icon: StarIcon },
          { href: "/admin/sessions", label: "Sessions live", icon: Video01Icon },
        ],
      },
      {
        titre: "Plateforme",
        entrees: [
          { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UserMultipleIcon },
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
    PROFIL,
  ],
};

export { PAGES_A_VENIR, type PageAVenir } from "./pages-a-venir";

/** Une entrée est active sur sa propre page et sur ses sous-pages (« /mes-formations/excel ») ; `exact` : sa page seule. */
export function isActive(pathname: string, href: string, exact = false): boolean {
  return pathname === href || (!exact && pathname.startsWith(`${href}/`));
}
