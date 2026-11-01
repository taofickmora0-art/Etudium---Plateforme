import { estFournisseur } from "@/lib/video/plateformes";
import { demoModeActive } from "@/lib/auth/current-user";
import { getFiche } from "@/lib/catalogue/data";
import { versReponse } from "@/lib/communaute/data";
import type { Reponse } from "@/lib/communaute/types";
import { estColonneAbsente, estTablesAbsentes, liste, texte, textes, un, verifier, type Ligne } from "@/lib/contenus/lecture";
import { cheminsImages, documentLu } from "./document";
import { signerImages } from "./images";
import { createClient } from "@/lib/supabase/server";
import { depuisMultirange } from "@/lib/video/suivi";
import { lireQuizAPasser } from "@/lib/quiz/data";
import { lireExercice } from "@/lib/exercices/data";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { DonneesLecon, LeconDetail, RessourceLecon, VideoLecon, VisionnageLecon } from "./types";

// Lecture de la page leçon. Le programme vient de la fiche (formations publiées, accès calculé par la base) ;
// la base ne renvoie le contenu et les ressources qu'avec l'accès à la leçon (règles de la 0004), et on ne les garde
// de toute façon que si `accessible` est vrai.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const versRessource = (r: Ligne): RessourceLecon => ({
  id: String(r.id),
  titre: texte(r.titre),
  format: texte(r.format),
  tailleOctets: Number(r.taille_octets ?? 0),
  telechargeable: r.telechargeable === true,
});

const rangDe = (r: Ligne) => Number(r.ordre ?? 0);

function versVideo(contenu: Ligne | null): VideoLecon | null {
  const fournisseur = contenu?.video_fournisseur;
  const id = texte(contenu?.video_id);
  return estFournisseur(fournisseur) && id ? { fournisseur, id } : null;
}

function versLecon(l: Ligne): LeconDetail {
  const accessible = l.accessible === true;
  const contenu = accessible ? un(l.lecons_contenus) : null;
  return {
    id: String(l.id),
    titre: texte(l.titre),
    dureeSecondes: Number(l.duree_secondes ?? 0),
    apercu: l.apercu === true,
    accessible,
    resume: texte(l.resume),
    pointsCles: textes(l.points_cles),
    video: versVideo(contenu),
    texte: texte(contenu?.texte),
    document: documentLu(contenu?.document),
    ressources: accessible ? [...liste(l.ressources)].sort((a, b) => rangDe(a) - rangDe(b)).map(versRessource) : [],
    visionnage: null,
  };
}

/** La note du compte connecté ; une table absente (0006 pas encore appliquée) ne bloque pas la page. */
async function lireNote(leconId: string): Promise<{ note: string | null; notesDisponibles: boolean }> {
  const supabase = await createClient();
  try {
    const ligne = verifier(await supabase.from("notes_lecons").select("texte").eq("lecon_id", leconId).maybeSingle()) as Ligne | null;
    return { note: texte(ligne?.texte) || null, notesDisponibles: true };
  } catch (erreur) {
    if (estTablesAbsentes(erreur)) return { note: null, notesDisponibles: false };
    throw erreur;
  }
}

/** Le temps regardé de la leçon ; une table absente (0007 pas encore appliquée) ne bloque pas la page. */
async function lireVisionnage(leconId: string): Promise<VisionnageLecon | null> {
  const supabase = await createClient();
  try {
    const ligne = verifier(
      await supabase.from("progression_lecons").select("passages, position_secondes, terminee_le").eq("lecon_id", leconId).maybeSingle(),
    ) as Ligne | null;
    return {
      passages: depuisMultirange(texte(ligne?.passages)),
      positionSecondes: Number(ligne?.position_secondes ?? 0),
      terminee: Boolean(ligne?.terminee_le),
    };
  } catch (erreur) {
    if (estTablesAbsentes(erreur)) return null;
    throw erreur;
  }
}

/** La page d'une leçon : null si l'adresse ne correspond à rien (formation non publiée, leçon d'une autre formation…). */
export async function getLecon(slug: string, leconId: string, connecte: boolean): Promise<DonneesLecon | null> {
  if (demoModeActive() || !UUID.test(leconId)) return null;
  const fiche = await getFiche(slug);
  return fiche ? getLeconDans(fiche, leconId, connecte) : null;
}

/** La leçon d'une fiche déjà lue (publiée, ou en aperçu pour l'équipe et le formateur) ; null si elle n'y est pas. */
export async function getLeconDans(fiche: FicheFormation, leconId: string, connecte: boolean): Promise<DonneesLecon | null> {
  if (demoModeActive() || !UUID.test(leconId)) return null;
  if (!fiche.modules.some((m) => m.lecons.some((l) => l.id === leconId))) return null;

  const supabase = await createClient();
  const lire = (contenu: string) =>
    supabase
      .from("lecons")
      .select(`id, titre, duree_secondes, apercu, resume, points_cles, accessible, lecons_contenus(${contenu}), ressources(id, titre, format, taille_octets, telechargeable, ordre)`)
      .eq("id", leconId)
      .maybeSingle();
  let reponse = await lire("video_fournisseur, video_id, texte, document");
  // Avant la 0055, la colonne du contenu riche manque : le texte ancien suffit.
  if (estColonneAbsente(reponse.error)) reponse = await lire("video_fournisseur, video_id, texte");
  const ligne = verifier(reponse) as Ligne | null;
  if (!ligne) return null;

  const lue = versLecon(ligne);
  const lecon = lue.document ? { ...lue, images: await signerImages(supabase, cheminsImages(lue.document)) } : lue;
  if (!connecte) return { fiche, lecon, note: null, notesDisponibles: true };
  // Un quiz (lot 3) : ses questions à passer, sans les bonnes réponses.
  // Un exercice (lot 3) : son statut et les versions du compte.
  const type = fiche.modules.flatMap((m) => m.lecons).find((l) => l.id === leconId)?.type ?? "lecon";
  const quiz = type === "quiz";
  const exercice = type === "exercice";
  const [notes, visionnage, discussion, questions, travail] = await Promise.all([
    lireNote(leconId),
    lecon.accessible && type === "lecon" ? lireVisionnage(leconId) : null,
    lecon.accessible ? lireDiscussion(leconId) : null,
    lecon.accessible && quiz ? lireQuizAPasser(leconId) : undefined,
    lecon.accessible && exercice ? lireExercice(leconId) : undefined,
  ]);
  return {
    fiche,
    lecon: { ...lecon, visionnage },
    ...notes,
    discussion,
    ...(quiz ? { quiz: questions ?? null } : {}),
    ...(exercice ? { exercice: travail ?? null } : {}),
  };
}

/**
 * La discussion d'une leçon (0028) : ses 10 derniers commentaires et leurs réponses, et le total. null sans accès,
 * commentaires fermés, ou avant la 0028 : la page n'affiche pas la section.
 */
export async function lireDiscussion(leconId: string): Promise<{ total: number; reponses: Reponse[] } | null> {
  if (demoModeActive() || !UUID.test(leconId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discussion_lecon", { p_lecon: leconId, p_tout: false });
  const lue = error ? null : un(data);
  if (!lue) return null;
  return { total: Number(lue.total) || 0, reponses: liste(lue.commentaires).map(versReponse) };
}
