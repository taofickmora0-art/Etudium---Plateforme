import { nomCourt } from "@/lib/communaute/regles";
import { heure } from "@/lib/notifications/temps";
import { libelleVocal } from "@/lib/vocal/regles";
import type { EspaceGroupes, MessageGroupe, ResumeGroupe } from "./types";

// Les règles des groupes (migration 0075), sans dépendance serveur : les écrans s'en servent aussi. La base applique les
// mêmes (envoyer_message_groupe, modifier_message_groupe).

export const TEXTE_MAX = 2000;
/** 5 Mo, comme l'espace « groupes ». */
export const IMAGE_MAX_OCTETS = 5_242_880;
export const FORMATS_IMAGE = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPT_IMAGE = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
/** Un message se modifie pendant 15 minutes. */
export const MODIFIABLE_MS = 15 * 60_000;
/** Deux messages d'un même auteur à moins de 5 minutes d'écart forment un seul bloc. */
export const ECART_BLOC_MS = 5 * 60_000;

export const MIGRATION_GROUPES = "Appliquez la migration 0075 (guide « Ce qui te revient », section 74).";
export const IMAGE_TROP_LOURDE = "L’image dépasse 5 Mo.";
export const IMAGE_REFUSEE = "L’image doit être au format JPEG, PNG ou WebP.";

/** Le refus d'une image choisie, ou null. */
export function refusImage(type: string | null, taille: number): string | null {
  if (!type || !(FORMATS_IMAGE as readonly string[]).includes(type)) return IMAGE_REFUSEE;
  if (taille > IMAGE_MAX_OCTETS) return IMAGE_TROP_LOURDE;
  return null;
}

/** Son message, en ligne, de moins de 15 minutes ; une note vocale ne se modifie pas. */
export function peutModifier(m: Pick<MessageGroupe, "deMoi" | "supprime" | "retire" | "creeLe" | "texte" | "vocal">, maintenant: Date): boolean {
  return m.deMoi && !m.supprime && !m.retire && !m.vocal && maintenant.getTime() - Date.parse(m.creeLe) < MODIFIABLE_MS;
}

/** « Awa K. » ; « Membre d’Étudium » sans prénom. */
export const nomAuteur = (a: { prenom: string; nom: string }) => nomCourt(a.prenom, a.nom);

/** Une ligne, au plus `max` caractères, avec « … ». */
export function extrait(texte: string, max = 90): string {
  const t = texte.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Ce que la liste dit du dernier message : « Vous : … », « Awa K. : … », « Message supprimé », « Image », la note vocale. */
export function apercuDernier(d: NonNullable<ResumeGroupe["dernier"]>): string {
  const qui = d.deMoi ? "Vous" : nomAuteur(d.auteur);
  const quoi = d.supprime
    ? "Message supprimé"
    : d.retire
      ? "Message retiré par la modération"
      : d.texte
        ? extrait(d.texte, 80)
        : d.vocal !== null
          ? `🎤 ${libelleVocal(d.vocal)}`
          : d.image
            ? "Image"
            : "";
  return `${qui} : ${quoi}`;
}

// Le jour au Bénin (UTC+1 toute l'année).
const FUSEAU = "Africa/Porto-Novo";
const JOUR = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" });
const LONG = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long" });
const LONG_ANNEE = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const UN_JOUR = 86_400_000;
const jour = (date: Date) => JOUR.format(date);
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** « Aujourd’hui », « Hier », « Lundi 3 novembre » (et l'année si ce n'est pas celle-ci). */
export function libelleJour(iso: string, maintenant: Date): string {
  const date = new Date(iso);
  if (jour(date) === jour(maintenant)) return "Aujourd’hui";
  if (jour(date) === jour(new Date(maintenant.getTime() - UN_JOUR))) return "Hier";
  const annee = jour(date).slice(0, 4) === jour(maintenant).slice(0, 4);
  return majuscule((annee ? LONG : LONG_ANNEE).format(date));
}

const SEMAINE = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, weekday: "long" });
const COURTE = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, day: "numeric", month: "short" });

/** L'heure du dernier message, dans la liste : « 14 h 05 », « Hier », « Lundi », sinon « 3 nov. ». */
export function momentListe(iso: string, maintenant: Date): string {
  const date = new Date(iso);
  if (jour(date) === jour(maintenant)) return heure(iso);
  if (jour(date) === jour(new Date(maintenant.getTime() - UN_JOUR))) return "Hier";
  if (maintenant.getTime() - date.getTime() < 6 * UN_JOUR) return majuscule(SEMAINE.format(date));
  return COURTE.format(date);
}

/** Un bloc : les messages consécutifs d'un même auteur, à moins de 5 minutes d'écart. */
export type Bloc = { cle: string; auteurId: string; deMoi: boolean; messages: MessageGroupe[] };
export type Jour = { cle: string; libelle: string; blocs: Bloc[] };

/** Le fil, par jour puis par bloc d'auteur, dans l'ordre reçu (du plus ancien au plus récent). */
export function grouperFil(messages: MessageGroupe[], maintenant: Date): Jour[] {
  const jours: Jour[] = [];
  for (const m of messages) {
    const cle = jour(new Date(m.creeLe));
    let j = jours.at(-1);
    if (j?.cle !== cle) {
      j = { cle, libelle: libelleJour(m.creeLe, maintenant), blocs: [] };
      jours.push(j);
    }
    const bloc = j.blocs.at(-1);
    const precedent = bloc?.messages.at(-1);
    if (bloc && precedent && bloc.auteurId === m.auteur.id && Date.parse(m.creeLe) - Date.parse(precedent.creeLe) < ECART_BLOC_MS) bloc.messages.push(m);
    else j.blocs.push({ cle: m.id, auteurId: m.auteur.id, deMoi: m.deMoi, messages: [m] });
  }
  return jours;
}

/** Le total des non-lus du menu : les groupes actifs qui ne sont pas coupés. */
export const totalNonLus = (groupes: Pick<ResumeGroupe, "nonLus" | "coupe" | "actif">[]) => groupes.reduce((t, g) => t + (g.actif && !g.coupe ? g.nonLus : 0), 0);

/** Les adresses des groupes dans chaque espace : le formateur a les siennes (restructuration R1). */
export const CHEMINS_GROUPES: Record<EspaceGroupes, { liste: string; groupe: (slug: string, message?: string | null) => string }> = {
  etudiant: { liste: "/groupes", groupe: (slug, message) => `/groupes/${slug}${message ? `?message=${message}` : ""}` },
  formateur: { liste: "/formateur/groupes", groupe: (slug, message) => `/formateur/groupes/${slug}${message ? `?message=${message}` : ""}` },
};

/** L'espace d'après l'adresse. */
export const espaceGroupesDe = (pathname: string | null): EspaceGroupes => (pathname === "/formateur" || pathname?.startsWith("/formateur/") ? "formateur" : "etudiant");
