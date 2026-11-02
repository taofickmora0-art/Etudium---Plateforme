import { Facebook01Icon, InstagramIcon, Linkedin01Icon, TelegramIcon, TiktokIcon, YoutubeIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@/components/ui/Icon";

// Les réseaux d'un formateur (migration 0070) : six réseaux, chacun une adresse en https:// de 300 caractères au plus
// (la base le vérifie aussi, contrainte formateurs_reseaux).

export const CLES_RESEAUX = ["instagram", "youtube", "linkedin", "facebook", "telegram", "tiktok"] as const;
export type CleReseau = (typeof CLES_RESEAUX)[number];
/** Les réseaux renseignés d'une fiche, par clé. */
export type Reseaux = Partial<Record<CleReseau, string>>;

export const RESEAU_MAX = 300;

/** Dans l'ordre d'affichage (fiche d'une formation, profil du formateur, formulaire du back-office). */
export const RESEAUX: readonly { cle: CleReseau; libelle: string; icone: IconSvgElement }[] = [
  { cle: "instagram", libelle: "Instagram", icone: InstagramIcon },
  { cle: "youtube", libelle: "YouTube", icone: YoutubeIcon },
  { cle: "linkedin", libelle: "LinkedIn", icone: Linkedin01Icon },
  { cle: "facebook", libelle: "Facebook", icone: Facebook01Icon },
  { cle: "telegram", libelle: "Telegram", icone: TelegramIcon },
  { cle: "tiktok", libelle: "TikTok", icone: TiktokIcon },
];

/** Une adresse de réseau acceptée : https://, sans espace, 300 caractères au plus (la règle de la base). */
export const adresseReseauValide = (valeur: string) => valeur.length <= RESEAU_MAX && /^https:\/\/\S+$/.test(valeur);

/** Les réseaux lus de la base : seulement les clés permises, avec une adresse acceptée. */
export function versReseaux(brut: unknown): Reseaux {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
  const reseaux: Reseaux = {};
  for (const [cle, valeur] of Object.entries(brut)) {
    if ((CLES_RESEAUX as readonly string[]).includes(cle) && typeof valeur === "string" && adresseReseauValide(valeur)) reseaux[cle as CleReseau] = valeur;
  }
  return reseaux;
}

/** Les réseaux renseignés, dans l'ordre de RESEAUX, avec leur libellé et leur icône. */
export const reseauxRenseignes = (reseaux: Reseaux) =>
  RESEAUX.flatMap((r) => (reseaux[r.cle] ? [{ ...r, url: reseaux[r.cle] as string }] : []));
