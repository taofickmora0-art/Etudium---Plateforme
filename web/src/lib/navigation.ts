import {
  AssignmentsIcon,
  BookOpen01Icon,
  BubbleChatIcon,
  Calendar03Icon,
  Certificate01Icon,
  CourseIcon,
  CreditCardIcon,
  FavouriteIcon,
  GiftIcon,
  HelpCircleIcon,
  Home03Icon,
  Route01Icon,
  Search01Icon,
  UserGroupIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/Icon";

// Source unique des entrées de menu de l'espace connecté (écran NdAccueil, téléphone NdMobAccueil et NdMobMenu).
export type NavEntry = { href: string; label: string; icon: IconSvgElement };

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

export { PAGES_A_VENIR, type PageAVenir } from "./pages-a-venir";

/** Une entrée est active sur sa propre page et sur ses sous-pages (« /mes-formations/excel »). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
