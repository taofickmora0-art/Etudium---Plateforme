import { cache } from "react";
import { demoModeActive } from "@/lib/auth/current-user";
import type { Badge, CouleurParcours, Niveau } from "@/lib/contenus/libelles";
import { lireAvecRepli, liste, parOrdre, texte, textes, un, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { LienMonetisation } from "./monetisation";
import { estLeconDeContenu } from "./regles";
import type { CarteCatalogue, FicheFormation, LeconFiche, ModuleFiche, ParcoursCatalogue } from "./types";

// Lecture du catalogue : formations publiées seulement, même pour l'équipe (les brouillons se voient au back-office).
// Les règles d'accès de la 0004 s'appliquent (un visiteur est « anon ») ; le contenu des leçons (vidéo) n'est jamais lu ici.

/** Forme d'une adresse de formation (spec §2) : sinon, page introuvable sans interroger la base. */
const ADRESSE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const COLONNES_PARCOURS = "slug, nom, nom_court, couleur, ordre, actif";
const COLONNES_CARTE =
  "id, slug, titre, resume, niveau, gratuite, badge, publiee_le, " + `formations_parcours(ordre, parcours(${COLONNES_PARCOURS}))`;

// Colonnes des migrations récentes : note et nombre d'avis (0010), couverture (0012). Une colonne absente (42703)
// fait relire sans elle : le catalogue s'affiche avant que les migrations soient appliquées.
const COLONNES_FACULTATIVES = [", note_moyenne, nb_avis, couverture", ", note_moyenne, nb_avis", ""];
// La fiche lit aussi le statut (0027) et le type (0031) des leçons : « colonnes de la formation|colonnes des leçons ».
const VARIANTES_FICHE = [`${COLONNES_FACULTATIVES[0]}|, publiee, type`, `${COLONNES_FACULTATIVES[0]}|, publiee`, ...COLONNES_FACULTATIVES.map((c) => `${c}|`)];
// Les cartes lisent le type des leçons (0031) : un quiz ne compte ni dans « n leçons » ni dans la durée.
const VARIANTES_CARTES = [`${COLONNES_FACULTATIVES[0]}|, type`, ...COLONNES_FACULTATIVES.map((c) => `${c}|`)];
const avecFiche = (lire: Parameters<typeof lireAvecRepli>[1]) => lireAvecRepli(VARIANTES_FICHE, lire);

const versParcours = (p: Ligne): ParcoursCatalogue => ({
  slug: texte(p.slug),
  nom: texte(p.nom),
  nomCourt: texte(p.nom_court),
  couleur: p.couleur as CouleurParcours,
  ordre: Number(p.ordre ?? 0),
});

/**
 * Les champs communs à la carte et à la fiche ; `lecons` donne la durée et le nombre de leçons (sans les quiz),
 * `nbModules` le nombre de modules du programme.
 */
function versCarte(f: Ligne, lecons: Ligne[], nbModules: number): CarteCatalogue {
  const contenu = lecons.filter((l) => estLeconDeContenu({ type: typeof l.type === "string" ? l.type : undefined }));
  const parcours = liste(f.formations_parcours)
    .map((lien) => ({ lien, p: un(lien.parcours) }))
    .filter(({ p }) => p && p.actif !== false)
    .map(({ lien, p }) => ({ ...versParcours(p as Ligne), position: Number(lien.ordre ?? 0) }))
    .sort(parOrdre);
  return {
    id: String(f.id),
    slug: texte(f.slug),
    titre: texte(f.titre),
    resume: texte(f.resume),
    niveau: f.niveau as Niveau,
    gratuite: f.gratuite === true,
    badge: (f.badge as Badge | null) ?? null,
    publieeLe: texte(f.publiee_le),
    dureeSecondes: contenu.reduce((total, l) => total + Number(l.duree_secondes ?? 0), 0),
    nbModules,
    nbLecons: contenu.length,
    nbQuiz: lecons.filter((l) => l.type === "quiz").length,
    nbExercices: lecons.filter((l) => l.type === "exercice").length,
    parcours,
    note: f.note_moyenne === null || f.note_moyenne === undefined ? null : Number(f.note_moyenne),
    nbAvis: Number(f.nb_avis ?? 0),
    couverture: texte(f.couverture) || null,
  };
}

export async function listCatalogue(): Promise<CarteCatalogue[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = (await lireAvecRepli(VARIANTES_CARTES, (variante) => {
    const [notes, lecons = ""] = variante.split("|");
    return supabase.from("formations").select(`${COLONNES_CARTE}${notes}, modules(lecons(duree_secondes${lecons}))`).eq("statut", "publiee");
  })) as Ligne[] | null;
  return (lignes ?? []).map((f) => versCarte(f, liste(f.modules).flatMap((m) => liste(m.lecons)), liste(f.modules).length));
}

/**
 * Les liens compétence → monétisation (0048), pour des formations que le compte peut voir ; aucun avant la 0048 ou si la
 * lecture échoue : les blocs « Et ensuite ? » et « À suivre d'abord » ne s'affichent simplement pas.
 */
export async function lireMonetisation(): Promise<LienMonetisation[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("formations_monetisation").select("business_id, competence_id");
  if (error) return [];
  return liste(data).map((l) => ({ businessId: texte(l.business_id), competenceId: texte(l.competence_id) }));
}

/**
 * Pour l'éditeur d'une formation (0048 ; restructuration, §5.3) : les formations publiées de Compétences digitales (sauf
 * elle-même), dans l'ordre du parcours, et celles qu'elle apprend déjà à vendre.
 */
export async function competencesAVendre(formationId: string): Promise<{ competences: { id: string; titre: string }[]; liees: string[] }> {
  const [cartes, liens] = await Promise.all([listCatalogue(), lireMonetisation()]);
  const position = (c: CarteCatalogue) => c.parcours.find((p) => p.couleur === "digital")?.position ?? Number.MAX_SAFE_INTEGER;
  return {
    competences: cartes
      .filter((c) => c.id !== formationId && c.parcours.some((p) => p.couleur === "digital"))
      .sort((a, b) => position(a) - position(b) || a.titre.localeCompare(b.titre, "fr"))
      .map((c) => ({ id: c.id, titre: c.titre })),
    liees: liens.filter((l) => l.businessId === formationId).map((l) => l.competenceId),
  };
}

export async function listParcoursCatalogue(): Promise<ParcoursCatalogue[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(await supabase.from("parcours").select(`${COLONNES_PARCOURS}, description`).eq("actif", true).order("ordre")) as Ligne[] | null;
  return (lignes ?? []).map((p) => ({ ...versParcours(p), description: texte(p.description) }));
}

const versLecon = (l: Ligne): LeconFiche & { ordre: number } => ({
  id: String(l.id),
  titre: texte(l.titre),
  titreCourt: texte(l.titre_court) || null,
  dureeSecondes: Number(l.duree_secondes ?? 0),
  apercu: l.apercu === true,
  accessible: l.accessible === true,
  publiee: l.publiee !== false,
  type: l.type === "quiz" || l.type === "exercice" ? l.type : "lecon",
  ordre: Number(l.ordre ?? 0),
});

const colonnesFiche = (variante: string) => {
  const [notes, lecons = ""] = variante.split("|");
  return (
    `${COLONNES_CARTE}${notes}, description, seuil_video, objectifs, competences, formateurs(nom, titre, domaine, presentation), ` +
    `modules(id, titre, ordre, lecons(id, titre, titre_court, duree_secondes, apercu, ordre, accessible${lecons}))`
  );
};

/** Une ligne de formation (avec son programme) → fiche : modules et leçons dans l'ordre. */
function versFiche(f: Ligne): FicheFormation {
  const modules = liste(f.modules)
    .map((m) => ({ id: String(m.id), titre: texte(m.titre), ordre: Number(m.ordre ?? 0), lecons: liste(m.lecons).map(versLecon).sort(parOrdre) }))
    .sort(parOrdre);
  const formateur = un(f.formateurs);
  return {
    ...versCarte(
      f,
      modules.flatMap((m) => m.lecons.map((l) => ({ duree_secondes: l.dureeSecondes, type: l.type }))),
      modules.length,
    ),
    description: texte(f.description),
    seuilVideo: Number(f.seuil_video ?? 90),
    objectifs: textes(f.objectifs),
    competences: textes(f.competences),
    formateur: formateur
      ? { nom: texte(formateur.nom), titre: texte(formateur.titre), domaine: texte(formateur.domaine), presentation: texte(formateur.presentation) }
      : null,
    modules: modules.map(
      (m): ModuleFiche => ({
        id: m.id,
        titre: m.titre,
        lecons: m.lecons.map((l) => ({
          id: l.id,
          titre: l.titre,
          titreCourt: l.titreCourt,
          dureeSecondes: l.dureeSecondes,
          apercu: l.apercu,
          accessible: l.accessible,
          publiee: l.publiee,
          type: l.type,
        })),
      }),
    ),
  };
}

/**
 * La fiche d'une formation publiée, avec son programme dans l'ordre ; null si l'adresse ne correspond à rien.
 * Lue une seule fois par requête : la page et ses métadonnées (aperçu du lien) la demandent toutes deux.
 */
export const getFiche = cache(async (slug: string): Promise<FicheFormation | null> => {
  if (demoModeActive() || !ADRESSE.test(slug)) return null;
  const supabase = await createClient();
  const f = (await avecFiche((variante) => supabase.from("formations").select(colonnesFiche(variante)).eq("statut", "publiee").eq("slug", slug).maybeSingle())) as Ligne | null;
  return f ? versFiche(f) : null;
});

export type StatutFiche = "publiee" | "archivee" | "brouillon" | "desactivee";

/**
 * Les fiches de plusieurs formations (Mes formations, Favoris), quel que soit leur statut : les règles de la base
 * décident (une formation archivée reste visible pour qui l'a commencée, migration 0009).
 */
export async function listFiches(ids: string[]): Promise<(FicheFormation & { statut: StatutFiche })[]> {
  if (demoModeActive() || ids.length === 0) return [];
  const supabase = await createClient();
  const lignes = (await avecFiche((variante) => supabase.from("formations").select(`${colonnesFiche(variante)}, statut`).in("id", ids))) as Ligne[] | null;
  return liste(lignes).map((f) => ({ ...versFiche(f), statut: (texte(f.statut) || "publiee") as StatutFiche }));
}

/**
 * Une formation par son adresse, quel que soit son statut : les règles de la base décident qui la lit (l'équipe et son
 * formateur, un brouillon ; qui l'a commencée, une formation archivée). Pour « Voir comme un étudiant » (catalogue/apercu).
 */
export const lireFicheParAdresse = cache(async (slug: string): Promise<(FicheFormation & { statut: StatutFiche }) | null> => {
  if (demoModeActive() || !ADRESSE.test(slug)) return null;
  const supabase = await createClient();
  const f = (await avecFiche((variante) => supabase.from("formations").select(`${colonnesFiche(variante)}, statut`).eq("slug", slug).maybeSingle())) as Ligne | null;
  return f ? { ...versFiche(f), statut: (texte(f.statut) || "publiee") as StatutFiche } : null;
});
