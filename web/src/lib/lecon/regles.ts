import { estMesuree, estVertical, urlIntegration as integrationPlateforme } from "@/lib/video/plateformes";
import { formatParMime, tailleLisible } from "@/lib/admin/fichiers";
import { leconsApercu } from "@/lib/catalogue/regles";
import type { FicheFormation, LeconFiche, ModuleFiche } from "@/lib/catalogue/types";
import type { RessourceLecon, VideoLecon } from "./types";

// Règles de la page leçon (NdLecon, NdMobLecon) : navigation dans le programme, vidéo, durées, verrou.

/** Longueur maximale d'une note privée (la base l'impose aussi, migration 0006). */
export const NOTE_MAX = 5000;

// Messages communs aux actions serveur et aux composants (une coupure réseau dit la même chose qu'un refus).
export const NOTE_ECHEC = "La note n’a pas pu être enregistrée. Réessayez.";
export const LIEN_ECHEC = "Le lien n’a pas pu être créé. Réessayez.";

type LeconAPlat = LeconFiche & { module: { numero: number; titre: string } };

/** Toutes les leçons, dans l'ordre du programme, avec leur module. */
export function leconsAPlat(modules: ModuleFiche[]): LeconAPlat[] {
  return modules.flatMap((m, index) => m.lecons.map((l) => ({ ...l, module: { numero: index + 1, titre: m.titre } })));
}

/** Leçons précédente et suivante, d'un module à l'autre (null au début, à la fin, ou si la leçon est inconnue). */
export function voisines(modules: ModuleFiche[], leconId: string): { precedente: LeconFiche | null; suivante: LeconFiche | null } {
  const lecons = modules.flatMap((m) => m.lecons);
  const i = lecons.findIndex((l) => l.id === leconId);
  if (i < 0) return { precedente: null, suivante: null };
  // Les leçons fermées au compte sont sautées : « Leçon suivante » ne mène jamais à un cadenas (tâche 12).
  const precedente = lecons.slice(0, i).findLast((l) => l.accessible) ?? null;
  const suivante = lecons.slice(i + 1).find((l) => l.accessible) ?? null;
  return { precedente, suivante };
}

/** Une partie seulement des leçons est ouverte au compte (les leçons d'aperçu, au milieu des cadenas). */
export function formationPartielle(fiche: Pick<FicheFormation, "modules">): boolean {
  return fiche.modules.some((m) => m.lecons.some((l) => !l.accessible));
}

/** « Leçon 4 sur 22 » : le rang de la leçon dans toute la formation (refonte des formations, spec §1.3). */
export function rangDansFormation(modules: ModuleFiche[], leconId: string): { rang: number; total: number } | null {
  const lecons = modules.flatMap((m) => m.lecons);
  const i = lecons.findIndex((l) => l.id === leconId);
  return i < 0 ? null : { rang: i + 1, total: lecons.length };
}

/** « Module 3 · Analyse de données », « Leçon 2 sur 3 de ce module ». */
export function situation(modules: ModuleFiche[], leconId: string): { numero: number; titreModule: string; rang: number; total: number } | null {
  for (const [index, m] of modules.entries()) {
    const rang = m.lecons.findIndex((l) => l.id === leconId);
    if (rang >= 0) return { numero: index + 1, titreModule: m.titre, rang: rang + 1, total: m.lecons.length };
  }
  return null;
}

/** Adresse du lecteur officiel : YouTube sans cookies publicitaires, Vimeo sans suivi. */
export function urlIntegration(video: VideoLecon): string {
  return integrationPlateforme(video);
}

/**
 * Le temps regardé de la vidéo se mesure (YouTube, Vimeo, TikTok, Tella) : « Terminer la leçon » attend le seuil.
 * Sans vidéo, ou sur une plateforme sans mesure (Loom, ScreenPal, Google Drive), la leçon se termine d'un clic.
 */
export const videoMesuree = (lecon: { video: VideoLecon | null }) => lecon.video !== null && estMesuree(lecon.video.fournisseur);

/** Le cadre de la vidéo : 16/9, ou vertical (TikTok) sans dépasser la hauteur de l'écran. */
// Sur ordinateur, le panneau de la leçon défile seul sous l'en-tête et la barre du haut : la vidéo tient entière dans ce
// qu'il reste de l'écran (environ 330 px pris au-dessus et en dessous), sa largeur suit donc la hauteur de l'écran.
export const FORMAT_VIDEO = {
  paysage: "aspect-video mx-auto w-full lg:w-[min(100%,calc((100dvh-330px)*16/9))]",
  vertical: "aspect-[9/16] mx-auto w-[min(100%,calc(80dvh*9/16))] lg:w-[min(100%,calc((100dvh-330px)*9/16))]",
} as const;
export const formatVideo = (video: VideoLecon) => (estVertical(video.fournisseur) ? FORMAT_VIDEO.vertical : FORMAT_VIDEO.paysage);

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/** Durée de l'en-tête : « 12 min 40 », « 12 min », « 45 s », « 1 h 02 min » ; vide si nulle. */
export function dureeLecon(secondes: number): string {
  if (secondes <= 0) return "";
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  const reste = secondes % 60;
  if (heures > 0) return minutes > 0 ? `${heures} h ${deuxChiffres(minutes)} min` : `${heures} h`;
  if (minutes === 0) return `${reste} s`;
  return reste > 0 ? `${minutes} min ${deuxChiffres(reste)}` : `${minutes} min`;
}

export type EtatLigne = "courante" | "terminee" | "a-venir" | "verrouillee";

/** État d'une ligne du programme. La leçon ouverte reste « courante », même fermée (sa page montre le verrou). */
export function etatLigne(lecon: LeconFiche, leconCourante: string, terminees: ReadonlySet<string>): EtatLigne {
  if (lecon.id === leconCourante) return "courante";
  if (!lecon.accessible) return "verrouillee";
  return terminees.has(lecon.id) ? "terminee" : "a-venir";
}

/** Secondes des leçons pas encore terminées (« 2 h restantes »). */
export function tempsRestant(modules: ModuleFiche[], terminees: ReadonlySet<string>): number {
  return modules.flatMap((m) => m.lecons).reduce((total, l) => (terminees.has(l.id) ? total : total + l.dureeSecondes), 0);
}

/** « Excel · 84 Ko · téléchargeable », « PDF · 1,2 Mo · consultation seule ». */
export function metaRessource(r: RessourceLecon): string {
  const format = formatParMime(r.format)?.label ?? "Fichier";
  return [format, tailleLisible(r.tailleOctets), r.telechargeable ? "téléchargeable" : "consultation seule"].join(" · ");
}

/**
 * Ce que dit une leçon fermée. Au lot 1, une formation gratuite ne se ferme qu'au visiteur : un compte gratuit l'ouvre.
 * Sinon, la leçon fait partie d'un parcours (formules au lot 2) ; l'aperçu gratuit reste proposé.
 */
export function verrou(
  fiche: Pick<FicheFormation, "gratuite" | "modules">,
  connecte: boolean,
  /** La leçon fermée : l'aperçu proposé est le prochain après elle (sinon le premier). */
  leconId?: string,
): { titre: string; texte: string; inscription: boolean; connexion: boolean; formules: boolean; apercu: LeconFiche | null } {
  if (fiche.gratuite && !connecte) {
    return {
      titre: "Cette leçon est réservée aux comptes Étudium",
      texte: "Créez votre compte gratuit pour suivre toute la formation.",
      inscription: true,
      connexion: true,
      formules: false,
      apercu: null,
    };
  }
  return {
    titre: "Cette leçon est verrouillée",
    texte: "Un abonnement ouvre toutes les formations. Les leçons d’aperçu restent ouvertes à tous.",
    inscription: !connecte,
    connexion: false,
    formules: connecte,
    apercu: apercuSuivant(fiche, leconId),
  };
}

/** Le prochain aperçu après la leçon donnée, sinon le premier de la formation. */
function apercuSuivant(fiche: Pick<FicheFormation, "modules">, leconId?: string): LeconFiche | null {
  const apercus = leconsApercu(fiche);
  const ordre = fiche.modules.flatMap((m) => m.lecons).map((l) => l.id);
  const rang = leconId ? ordre.indexOf(leconId) : -1;
  return apercus.find((a) => ordre.indexOf(a.id) > rang) ?? apercus[0] ?? null;
}
