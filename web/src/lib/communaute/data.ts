import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, textes, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { NOMBRE_FIL, UUID } from "./regles";
import { videoRangee } from "./video";
import type {
  Activite,
  Apercu,
  Espace,
  FiltreFil,
  LotPublications,
  PieceJointe,
  Publication,
  PublicationDetail,
  Reponse,
  RoleAuteur,
  StatutPublication,
  SuiteFil,
  Tendance,
  TriFil,
} from "./types";

// Lectures de la communauté (migration 0019 ; fil « Actualités », 0021). La base ne rend que les espaces ouverts au
// compte, et jamais d'adresse e-mail ; les fichiers joints reçoivent ici un lien temporaire (1 h), demandé en une fois
// pour tout le lot.

export { UUID };
const DUREE_LIEN = 3600;
const nombre = (valeur: unknown) => Number(valeur) || 0;
const texteOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const role = (valeur: unknown): RoleAuteur => (valeur === "formateur" || valeur === "equipe" ? valeur : null);
// Avant la 0020, la base ne dit rien du statut : tout est en ligne.
const statut = (valeur: unknown): StatutPublication => (valeur === "en_attente" || valeur === "bloquee" ? valeur : "publiee");

type Client = Awaited<ReturnType<typeof createClient>>;
type Erreur = { code?: string; message?: string };

export function versEspace(l: Ligne): Espace {
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
    peutSignaler: l.peut_signaler === true,
  };
}

function versPiece(valeur: unknown): PieceJointe | null {
  const p = un(valeur);
  if (!p || !texte(p.chemin)) return null;
  return { chemin: texte(p.chemin), nom: texte(p.nom), type: texte(p.type), taille: nombre(p.taille), url: null };
}

/** L'aperçu rangé par la base (0021) ; toute autre forme est ignorée. */
export function versApercu(valeur: unknown): Apercu | null {
  const a = un(valeur);
  if (a?.type === "youtube" && texte(a.id)) return { type: "youtube", id: texte(a.id) };
  if (a?.type === "lien" && texte(a.url)) return { type: "lien", url: texte(a.url), titre: texte(a.titre), description: texte(a.description), image: texteOuNull(a.image) };
  return null;
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
    statut: statut(l.statut),
    reactions: nombre(l.reactions),
    jAime: l.j_aime === true,
    reponses: nombre(l.reponses),
    dernieresReponses: liste(l.dernieres_reponses).map(versReponse),
    peutSupprimer: l.peut_supprimer === true,
    peutSignaler: l.peut_signaler === true,
    apercu: versApercu(l.apercu),
    enregistree: l.enregistree === true,
    aimeePar: textes(l.aimee_par),
    video: videoRangee(l.video),
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

const TRIS: TriFil[] = ["recentes", "populaires", "enregistrees"];

/** Lit un lot du fil ; sert aussi à l'action « Voir plus ». Avant la 0021, l'ancien fil (le plus récent d'abord). */
export async function lireLot(supabase: Client, espace: FiltreFil, tri: TriFil = "recentes", suite: SuiteFil = {}) {
  const filtre = espace === "tous" || espace === "general" || UUID.test(espace) ? espace : "tous";
  const curseur = suite.curseur ?? null;
  const avant = curseur?.avant ?? null;
  const avantId = curseur && UUID.test(curseur.avantId) ? curseur.avantId : null;
  let { data, error } = await supabase.rpc("fil_communaute", {
    p_espace: filtre,
    p_tri: TRIS.includes(tri) ? tri : "recentes",
    p_avant: avant,
    p_avant_id: avantId,
    p_page: Number.isInteger(suite.page) && (suite.page ?? 0) > 0 ? suite.page : 0,
    p_nombre: NOMBRE_FIL,
  });
  if (error && estFonctionAbsente(error)) {
    ({ data, error } = await supabase.rpc("fil_communaute", {
      p_espace: filtre === "general" ? "tous" : filtre,
      p_avant: avant,
      p_avant_id: avantId,
      p_nombre: NOMBRE_FIL,
    }));
  }
  if (error) return { error };
  const brut = un(data);
  const publications = await avecLiens(supabase, liste(brut?.publications).map(versPublication));
  return { lot: { publications, suite: brut?.suite === true } satisfies LotPublications };
}

/** Le fil d'un espace, dans l'ordre du tri. */
export async function lireFil(espace: FiltreFil, tri: TriFil = "recentes", suite: SuiteFil = {}): Promise<Lecture<LotPublications>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: { publications: [], suite: false } };
  const resultat = await lireLot(await createClient(), espace, tri, suite);
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

/** L'analyse automatique est-elle active (migration 0020) ? Faux avant la 0020 ou si la lecture échoue : ce n'est qu'une mention. */
export async function lireAnalyseActive(): Promise<boolean> {
  if (demoModeActive()) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("moderation_active");
  return !error && data === true;
}

/** Les publications tendances de la colonne de droite (0021). */
export async function lireTendances(): Promise<Lecture<Tendance[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publications_tendances");
  return (
    verifier("des tendances", error) ?? {
      migrationAbsente: false,
      donnees: liste(data).map((l) => {
        const auteur = un(l.auteur);
        return { id: texte(l.id), extrait: texte(l.extrait), auteur: { nomCourt: texte(auteur?.nom_court), initiales: texte(auteur?.initiales), equipe: auteur?.equipe === true } };
      }),
    }
  );
}

/** Les activités récentes de la colonne de droite (0021). */
export async function lireActivites(): Promise<Lecture<Activite[]>> {
  if (demoModeActive()) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("activites_recentes");
  return (
    verifier("des activités", error) ?? {
      migrationAbsente: false,
      donnees: liste(data).map((l) => {
        const auteur = un(l.auteur);
        return {
          type: l.type === "commentaire" ? "commentaire" : "publication",
          publicationId: texte(l.publication_id),
          auteur: { nomCourt: texte(auteur?.nom_court), initiales: texte(auteur?.initiales) },
          extrait: texte(l.extrait),
          creeLe: texte(l.cree_le),
        };
      }),
    }
  );
}
