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

const LOT_1 = "au lot 1, Catalogue et apprentissage";
const LOT_5 = "au lot 5, Communauté et accompagnement";

/**
 * Pages « Bientôt disponible » : clé = adresse sans « / ». `quand` dit à quel moment l'écran arrive,
 * d'après la feuille de route (docs/superpowers/specs/2026-10-09-feuille-de-route-design.md).
 */
export const PAGES_A_VENIR = {
  evenements: { titre: "Événements", quand: LOT_5, description: "Les sessions live et les événements de vos parcours s’afficheront ici." },
  communaute: { titre: "Communauté", quand: LOT_5, description: "Vous pourrez échanger avec les autres étudiants de vos parcours." },
  messages: { titre: "Messages", quand: LOT_5, description: "Vous pourrez écrire à vos formateurs." },
  notifications: { titre: "Notifications", quand: LOT_5, description: "Toutes vos notifications seront réunies ici." },
  "mes-formations": { titre: "Mes formations", quand: LOT_1, description: "Vous retrouverez ici les formations que vous suivez." },
  parcours: { titre: "Mes parcours", quand: LOT_1, description: "Vos parcours et leurs formations s’afficheront ici." },
  formations: { titre: "Toutes les formations", quand: LOT_1, description: "Le catalogue complet des formations s’affichera ici." },
  "formations-gratuites": { titre: "Formations gratuites", quand: LOT_1, description: "Les formations gratuites s’afficheront ici." },
  favoris: { titre: "Favoris", quand: LOT_1, description: "Les formations que vous mettez de côté s’afficheront ici." },
  recherche: { titre: "Recherche", quand: LOT_1, description: "Vous pourrez chercher une formation, un parcours ou une ressource." },
  aide: { titre: "Aide", quand: LOT_1, description: "Les réponses aux questions fréquentes s’afficheront ici." },
  exercices: { titre: "Exercices", quand: "au lot 3, Quiz, exercices et certificats", description: "Vos exercices à rendre et à corriger s’afficheront ici." },
  certificats: { titre: "Certificats", quand: "au lot 3, Quiz, exercices et certificats", description: "Vos certificats et leur QR Code de vérification s’afficheront ici." },
  abonnement: { titre: "Mon abonnement", quand: "au lot 2, Abonnements et paiement", description: "Votre formule, vos paiements et vos reçus s’afficheront ici." },
  formateur: { titre: "Espace formateur", quand: "au lot 4, Espace formateur", description: "Les formateurs y créeront et suivront leurs formations." },
  admin: { titre: "Back-office", quand: "au lot 1, avec le back-office de saisie", description: "L’équipe Étudium y gérera les formations et les comptes." },
  profil: { titre: "Mon profil", quand: "à la tâche 0.5, juste après la connexion", description: "Vous pourrez modifier vos informations, votre photo et vos préférences." },
} satisfies Record<string, { titre: string; quand: string; description: string }>;

export type PageAVenir = keyof typeof PAGES_A_VENIR;

/** Une entrée est active sur sa propre page et sur ses sous-pages (« /mes-formations/excel »). */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
