import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { NOMBRE_FIL } from "./regles";
import type { Curseur, Espace, FiltreFil, LotPublications, MembreActif, PieceJointe, Publication, PublicationDetail, Reponse, RoleAuteur } from "./types";

// Lectures de la communauté (migration 0019). La base ne rend que les espaces ouverts au compte, et jamais d'adresse
// e-mail ; les fichiers joints reçoivent ici un lien temporaire (1 h), demandé en une fois pour tout le lot.

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DUREE_LIEN = 3600;
const nombre = (valeur: unknown) => Number(valeur) || 0;
const texteOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const role = (valeur: unknown): RoleAuteur => (valeur === "formateur" || valeur === "equipe" ? valeur : null);

type Client = Awaited<ReturnType<typeof createClient>>;
type Erreur = { code?: string; message?: string };

function versEspace(l: Ligne): Espace {
  return {
    id: texteOuNull(l.id),
    nom: texte(l.nom),
    nomCourt: texte(l.nom_court),
    couleur: texteOuNull(l.couleur),
    slug: texteOuNull(l.slug),
    ouvert: l.ouvert === true,
  };
}

export function versReponse(l: Ligne): Reponse {
  const auteur = un(l.auteur);
  return {
    id: texte(l.id),
    auteur: { prenom: texte(auteur?.prenom), nomCourt: texte(auteur?.nom_court) },
    estMoi: l.est_moi === true,
    texte: texte(l.texte),
    creeLe: texte(l.cree_le),
    peutSupprimer: l.peut_supprimer === true,
  };
}

function versPiece(valeur: unknown): PieceJointe | null {
  const p = un(valeur);
  if (!p || !texte(p.chemin)) return null;
  return { chemin: texte(p.chemin), nom: texte(p.nom), type: texte(p.type), taille: nombre(p.taille), url: null };
}

export function versPublication(l: Ligne): Publication {
  const auteur = un(l.auteur);
  const espace = un(l.espace);
  return {
    id: texte(l.id),
    auteur: { prenom: texte(auteur?.prenom), nom: texte(auteur?.nom), role: role(auteur?.role) },
    estMoi: l.est_moi === true,
    espace: { id: texteOuNull(espace?.id), nom: texte(espace?.nom) },
    titre: texte(l.titre),
    texte: texte(l.texte),
    pieceJointe: versPiece(l.piece_jointe),
    creeLe: texte(l.cree_le),
    modifiee: l.modifiee === true,
    reactions: nombre(l.reactions),
    jAime: l.j_aime === true,
    reponses: nombre(l.reponses),
    dernieresReponses: liste(l.dernieres_reponses).map(versReponse),
    peutSupprimer: l.peut_supprimer === true,
  };
}

/** Ajoute les liens temporaires des fichiers joints, en un seul appel ; un lien manquant reste null. */
export async function avecLiens<T extends Publication>(supabase: Client, publications: T[]): Promise<T[]> {
  const chemins = publications.flatMap((p) => (p.pieceJointe ? [p.pieceJointe.chemin] : []));
  if (chemins.length === 0) return publications;
  const { data, error } = await supabase.storage.from("communaute").createSignedUrls(chemins, DUREE_LIEN);
  const liens = new Map<string, string>();
  if (!error) {
    for (const lien of data ?? []) if (lien.path && lien.signedUrl && !lien.error) liens.set(lien.path, lien.signedUrl);
  }
  return publications.map((p) => (p.pieceJointe ? { ...p, pieceJointe: { ...p.pieceJointe, url: liens.get(p.pieceJointe.chemin) ?? null } } : p));
}

/** Rend la lecture, migrationAbsente sans la 0019, et relance toute autre erreur. */
function verifier(quoi: string, error: Erreur | null): { migrationAbsente: true } | null {
  if (!error) return null;
  if (estFonctionAbsente(error)) return { migrationAbsente: true };
  throw new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);
}

/** Les onglets : Général puis les parcours actifs, ouverts ou verrouillés. */
export async function lireEspaces(): Promise<Lecture<Espace[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("espaces_communaute");
  return verifier("des espaces", error) ?? { migrationAbsente: false, donnees: liste(data).map(versEspace) };
}

/** Lit un lot du fil ; sert aussi à l'action « Voir plus ». */
export async function lireLot(supabase: Client, espace: FiltreFil, suite?: Curseur | null) {
  const { data, error } = await supabase.rpc("fil_communaute", {
    p_espace: espace === "tous" || UUID.test(espace) ? espace : "tous",
    p_avant: suite?.avant ?? null,
    p_avant_id: suite && UUID.test(suite.avantId) ? suite.avantId : null,
    p_nombre: NOMBRE_FIL,
  });
  if (error) return { error };
  const brut = un(data);
  const publications = await avecLiens(supabase, liste(brut?.publications).map(versPublication));
  return { lot: { publications, suite: brut?.suite === true } satisfies LotPublications };
}

/** Le fil d'un onglet, le plus récent d'abord. */
export async function lireFil(espace: FiltreFil, suite?: Curseur | null): Promise<Lecture<LotPublications>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: { publications: [], suite: false } };
  const resultat = await lireLot(await createClient(), espace, suite);
  if ("error" in resultat) return verifier("du fil", resultat.error ?? null) ?? { migrationAbsente: false, donnees: { publications: [], suite: false } };
  return { migrationAbsente: false, donnees: resultat.lot };
}

/** Une publication et toutes ses réponses ; null si elle n'existe pas, si son espace est fermé, ou pour un identifiant mal formé. */
export async function lirePublication(id: string): Promise<Lecture<PublicationDetail | null>> {
  if (!UUID.test(id) || demoModeActive()) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publication_communaute", { p_id: id });
  const absente = verifier("de la publication", error);
  if (absente) return absente;
  const l = un(data);
  if (!l) return { migrationAbsente: false, donnees: null };
  const [publication] = await avecLiens(supabase, [{ ...versPublication(l), toutesReponses: liste(l.toutes_reponses).map(versReponse) }]);
  return { migrationAbsente: false, donnees: publication };
}

/** Les trois membres qui ont le plus écrit en 7 jours. */
export async function lireMembresActifs(): Promise<Lecture<MembreActif[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("membres_actifs");
  return (
    verifier("des membres actifs", error) ?? {
      migrationAbsente: false,
      donnees: liste(data).map((m) => ({ prenom: texte(m.prenom), nomCourt: texte(m.nom_court), initiales: texte(m.initiales), espace: texte(m.espace) })),
    }
  );
}
