import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { CATEGORIES, MOTIFS, type Categorie, type Decision, type ElementFile, type EtatModeration, type MotifSignalement, type OngletFile } from "./types";

// Lectures de la modération (migration 0020), pour l'équipe. Les fichiers joints reçoivent un lien temporaire (1 h).

type Client = Awaited<ReturnType<typeof createClient>>;
type Erreur = { code?: string; message?: string };

const nombre = (valeur: unknown) => Number(valeur) || 0;
const texteOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const motif = (valeur: unknown): MotifSignalement => (MOTIFS.includes(valeur as MotifSignalement) ? (valeur as MotifSignalement) : "autre");
const categorie = (valeur: unknown): Categorie => (CATEGORIES.includes(valeur as Categorie) ? (valeur as Categorie) : "autre");
const DECISIONS: Decision[] = ["autoriser", "signaler", "bloquer", "echec"];
const statut = (valeur: unknown): ElementFile["statut"] => (valeur === "en_attente" || valeur === "bloquee" ? valeur : "publiee");

export function versElement(l: Ligne): ElementFile {
  const espace = un(l.espace);
  const auteur = un(l.auteur);
  const piece = un(l.piece_jointe);
  const analyse = un(l.analyse);
  const signalements = un(l.signalements);
  return {
    type: l.type === "reponse" ? "reponse" : "publication",
    id: texte(l.id),
    publicationId: texte(l.publication_id),
    espace: { id: texteOuNull(espace?.id), nom: texte(espace?.nom) },
    auteur: { id: texte(auteur?.id), prenom: texte(auteur?.prenom), nom: texte(auteur?.nom) },
    creeLe: texte(l.cree_le),
    titre: texte(l.titre),
    texte: texte(l.texte),
    pieceJointe: piece && texte(piece.chemin) ? { chemin: texte(piece.chemin), nom: texte(piece.nom), type: texte(piece.type), taille: nombre(piece.taille), url: null } : null,
    statut: statut(l.statut),
    analyse:
      analyse && DECISIONS.includes(analyse.decision as Decision)
        ? { decision: analyse.decision as Decision, categorie: categorie(analyse.categorie), raison: texte(analyse.raison) }
        : null,
    extrait: texteOuNull(l.extrait),
    signalements: {
      nombre: nombre(signalements?.nombre),
      motifs: liste(signalements?.motifs).map((m) => ({ motif: motif(m.motif), nombre: nombre(m.nombre) })),
      details: liste(signalements?.details).map((d) => ({ motif: motif(d.motif), precisions: texte(d.precisions), par: texte(d.par), le: texte(d.le) })),
    },
  };
}

/** Les liens temporaires des fichiers, en un seul appel ; un lien manquant reste null. */
export async function avecLiens(supabase: Client, elements: ElementFile[]): Promise<ElementFile[]> {
  const chemins = elements.flatMap((e) => (e.pieceJointe ? [e.pieceJointe.chemin] : []));
  if (chemins.length === 0) return elements;
  const { data, error } = await supabase.storage.from("communaute").createSignedUrls(chemins, 3600);
  const liens = new Map<string, string>();
  if (!error) for (const lien of data ?? []) if (lien.path && lien.signedUrl && !lien.error) liens.set(lien.path, lien.signedUrl);
  return elements.map((e) => (e.pieceJointe ? { ...e, pieceJointe: { ...e.pieceJointe, url: liens.get(e.pieceJointe.chemin) ?? null } } : e));
}

/** Rend migrationAbsente sans la 0020, et relance toute autre erreur. */
function verifier(quoi: string, error: Erreur | null): { migrationAbsente: true } | null {
  if (!error) return null;
  if (estFonctionAbsente(error)) return { migrationAbsente: true };
  throw new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);
}

/** Un onglet de la file : « À examiner » ou « Bloquées ». */
export async function lireFileModeration(onglet: OngletFile): Promise<Lecture<ElementFile[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("file_moderation", { p_onglet: onglet });
  const absente = verifier("de la file de modération", error);
  if (absente) return absente;
  return { migrationAbsente: false, donnees: await avecLiens(supabase, liste(data).map(versElement)) };
}

/** L'état de l'analyse : la base, et ce que le serveur a (clé de l'IA, jeton de modération, sans jamais les montrer). */
export async function lireEtatModeration(): Promise<Lecture<EtatModeration>> {
  const cle = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const jeton = process.env.MODERATION_JETON?.trim() || null;
  if (demoModeActive()) return { migrationAbsente: false, donnees: { active: false, cle, jeton: jeton ? "non_reconnu" : "absent", derniereAnalyse: null, enAttente: 0 } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("etat_moderation", { p_jeton: jeton });
  const absente = verifier("de l'état de la modération", error);
  if (absente) return absente;
  const etat = un(data);
  return {
    migrationAbsente: false,
    donnees: {
      active: etat?.active === true,
      cle,
      jeton: etat?.jeton_reconnu === true ? "reconnu" : etat?.jeton_reconnu === false ? "non_reconnu" : "absent",
      derniereAnalyse: texteOuNull(etat?.derniere_analyse),
      enAttente: nombre(etat?.en_attente),
    },
  };
}

/** Le nombre de contenus à examiner (tuile du tableau de bord) ; null avant la 0020. */
export async function lireNombreAExaminer(): Promise<number | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("nombre_a_examiner");
  if (verifier("du nombre à examiner", error)) return null;
  return nombre(data);
}
