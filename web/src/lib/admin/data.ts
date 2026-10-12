import { demoModeActive } from "@/lib/auth/current-user";
import type { Badge, CouleurParcours, Niveau, StatutFormation } from "@/lib/contenus/libelles";
import { createClient } from "@/lib/supabase/server";
import type {
  FormateurAdmin,
  FormationAdmin,
  FormationResume,
  LeconAdmin,
  LeconResume,
  ModuleAdmin,
  ParcoursAdmin,
  RessourceAdmin,
  ResumeContenus,
} from "./types";

// Lecture des contenus pour le back-office. Les pages vérifient d'abord l'équipe (requireSpace) ; la base revérifie
// (règles d'accès de la 0004 : l'équipe voit aussi les brouillons et les archives).

/** Les tables du lot 1 ne sont pas encore dans la base : la migration 0004 n'a pas été appliquée. */
export class TablesAbsentesError extends Error {
  constructor() {
    super("Tables du lot 1 absentes : migration 0004 à appliquer.");
    this.name = "TablesAbsentesError";
  }
}

type ErreurSupabase = { code?: string; message?: string } | null;
const TABLES_ABSENTES = new Set(["PGRST205", "42P01"]);

function verifier<T>(reponse: { data: T; error: ErreurSupabase }): T {
  if (reponse.error) {
    if (reponse.error.code && TABLES_ABSENTES.has(reponse.error.code)) throw new TablesAbsentesError();
    throw new Error(reponse.error.message ?? "Lecture des contenus impossible.");
  }
  return reponse.data;
}

type Ligne = Record<string, unknown>;
/** Une relation « un à un » arrive en objet ou en tableau selon ce que Supabase devine : on accepte les deux. */
const un = (valeur: unknown): Ligne | null => (Array.isArray(valeur) ? ((valeur[0] as Ligne | undefined) ?? null) : ((valeur as Ligne | null) ?? null));
const liste = (valeur: unknown): Ligne[] => (Array.isArray(valeur) ? (valeur as Ligne[]) : []);
const texte = (valeur: unknown) => (typeof valeur === "string" ? valeur : "");
const textes = (valeur: unknown) => (Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === "string") : []);
const parOrdre = <T extends { ordre: number }>(a: T, b: T) => a.ordre - b.ordre;

const versParcours = (p: Ligne): ParcoursAdmin => ({
  id: String(p.id),
  slug: texte(p.slug),
  nom: texte(p.nom),
  nomCourt: texte(p.nom_court),
  description: texte(p.description),
  couleur: p.couleur as CouleurParcours,
  ordre: Number(p.ordre ?? 0),
  actif: p.actif !== false,
});

const versFormateur = (f: Ligne): FormateurAdmin => ({
  id: String(f.id),
  nom: texte(f.nom),
  titre: texte(f.titre),
  domaine: texte(f.domaine),
  presentation: texte(f.presentation),
});

const versLeconResume = (l: Ligne): LeconResume & { ordre: number } => ({
  id: String(l.id),
  titre: texte(l.titre),
  dureeSecondes: Number(l.duree_secondes ?? 0),
  apercu: l.apercu === true,
  aVideo: Boolean(un(l.lecons_contenus)?.video_id),
  ordre: Number(l.ordre ?? 0),
});

const sansOrdre = (lecon: LeconResume & { ordre: number }): LeconResume => ({
  id: lecon.id,
  titre: lecon.titre,
  dureeSecondes: lecon.dureeSecondes,
  apercu: lecon.apercu,
  aVideo: lecon.aVideo,
});

const versModule = (m: Ligne): ModuleAdmin => ({
  id: String(m.id),
  titre: texte(m.titre),
  ordre: Number(m.ordre ?? 0),
  lecons: liste(m.lecons).map(versLeconResume).sort(parOrdre).map(sansOrdre),
});

const nomsDesParcours = (f: Ligne) =>
  liste(f.formations_parcours)
    .map((lien) => texte(un(lien.parcours)?.nom_court))
    .filter(Boolean);

const COLONNES_PARCOURS = "id, slug, nom, nom_court, description, couleur, ordre, actif";
const COLONNES_FORMATEUR = "id, nom, titre, domaine, presentation";

export async function listParcours(): Promise<ParcoursAdmin[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(await supabase.from("parcours").select(COLONNES_PARCOURS).order("ordre").order("cree_le"));
  return (lignes as Ligne[]).map(versParcours);
}

export async function getParcours(id: string): Promise<ParcoursAdmin | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const ligne = verifier(await supabase.from("parcours").select(COLONNES_PARCOURS).eq("id", id).maybeSingle());
  return ligne ? versParcours(ligne as Ligne) : null;
}

export async function listFormateurs(): Promise<FormateurAdmin[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(await supabase.from("formateurs").select(COLONNES_FORMATEUR).order("nom"));
  return (lignes as Ligne[]).map(versFormateur);
}

export async function getFormateur(id: string): Promise<FormateurAdmin | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const ligne = verifier(await supabase.from("formateurs").select(COLONNES_FORMATEUR).eq("id", id).maybeSingle());
  return ligne ? versFormateur(ligne as Ligne) : null;
}

export async function listFormations(): Promise<FormationResume[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(
    await supabase
      .from("formations")
      .select("id, slug, titre, statut, niveau, formations_parcours(parcours(nom_court)), modules(lecons(id))")
      .order("titre"),
  );
  return (lignes as Ligne[]).map((f) => ({
    id: String(f.id),
    slug: texte(f.slug),
    titre: texte(f.titre),
    statut: f.statut as StatutFormation,
    niveau: f.niveau as Niveau,
    nbLecons: liste(f.modules).reduce((total, m) => total + liste(m.lecons).length, 0),
    parcours: nomsDesParcours(f),
  }));
}

export async function getFormationAdmin(id: string): Promise<FormationAdmin | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const f = verifier(
    await supabase
      .from("formations")
      .select(
        "id, slug, titre, statut, niveau, resume, description, objectifs, competences, formateur_id, gratuite, achat_separe, prix_fcfa, badge, seuil_video, publiee_le, " +
          "formations_parcours(parcours_id, parcours(nom_court)), " +
          "modules(id, titre, ordre, lecons(id, titre, duree_secondes, apercu, ordre, lecons_contenus(video_id)))",
      )
      .eq("id", id)
      .maybeSingle(),
  ) as Ligne | null;
  if (!f) return null;
  const modules = liste(f.modules).map(versModule).sort(parOrdre);
  return {
    id: String(f.id),
    slug: texte(f.slug),
    titre: texte(f.titre),
    statut: f.statut as StatutFormation,
    niveau: f.niveau as Niveau,
    nbLecons: modules.reduce((total, m) => total + m.lecons.length, 0),
    parcours: nomsDesParcours(f),
    resume: texte(f.resume),
    description: texte(f.description),
    objectifs: textes(f.objectifs),
    competences: textes(f.competences),
    formateurId: typeof f.formateur_id === "string" ? f.formateur_id : null,
    gratuite: f.gratuite === true,
    achatSepare: f.achat_separe === true,
    prixFcfa: typeof f.prix_fcfa === "number" ? f.prix_fcfa : null,
    badge: (f.badge as Badge | null) ?? null,
    seuilVideo: Number(f.seuil_video ?? 90),
    publieeLe: typeof f.publiee_le === "string" ? f.publiee_le : null,
    parcoursIds: liste(f.formations_parcours).map((lien) => String(lien.parcours_id)),
    modules,
  };
}

const versRessource = (r: Ligne): RessourceAdmin => ({
  id: String(r.id),
  titre: texte(r.titre),
  fichier: texte(r.fichier),
  format: texte(r.format),
  tailleOctets: Number(r.taille_octets ?? 0),
  telechargeable: r.telechargeable !== false,
  ordre: Number(r.ordre ?? 0),
});

export async function getLeconAdmin(id: string): Promise<LeconAdmin | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const l = verifier(
    await supabase
      .from("lecons")
      .select(
        "id, module_id, titre, titre_court, duree_secondes, apercu, resume, points_cles, " +
          "modules(formation_id, formations(titre)), " +
          "lecons_contenus(video_fournisseur, video_id, texte), " +
          "ressources(id, titre, fichier, format, taille_octets, telechargeable, ordre)",
      )
      .eq("id", id)
      .maybeSingle(),
  ) as Ligne | null;
  if (!l) return null;
  const parent = un(l.modules);
  const contenu = un(l.lecons_contenus);
  const fournisseur = contenu?.video_fournisseur;
  const videoId = contenu?.video_id;
  return {
    id: String(l.id),
    moduleId: String(l.module_id),
    formationId: String(parent?.formation_id ?? ""),
    formationTitre: texte(un(parent?.formations)?.titre),
    titre: texte(l.titre),
    titreCourt: typeof l.titre_court === "string" ? l.titre_court : null,
    dureeSecondes: Number(l.duree_secondes ?? 0),
    apercu: l.apercu === true,
    resume: texte(l.resume),
    pointsCles: textes(l.points_cles),
    video: (fournisseur === "youtube" || fournisseur === "vimeo") && typeof videoId === "string" ? { fournisseur, id: videoId } : null,
    texte: texte(contenu?.texte),
    ressources: liste(l.ressources).map(versRessource).sort(parOrdre),
  };
}

/** Le résumé de l'accueil du back-office. */
export async function compterContenus(): Promise<ResumeContenus> {
  if (demoModeActive()) return { parcours: 0, formateurs: 0, publiees: 0, brouillons: 0, archivees: 0 };
  const supabase = await createClient();
  const [parcours, formateurs, formations] = await Promise.all([
    supabase.from("parcours").select("id", { count: "exact", head: true }),
    supabase.from("formateurs").select("id", { count: "exact", head: true }),
    supabase.from("formations").select("statut"),
  ]);
  verifier(parcours);
  verifier(formateurs);
  const statuts = (verifier(formations) as Ligne[] | null) ?? [];
  const compter = (statut: StatutFormation) => statuts.filter((f) => f.statut === statut).length;
  return {
    parcours: parcours.count ?? 0,
    formateurs: formateurs.count ?? 0,
    publiees: compter("publiee"),
    brouillons: compter("brouillon"),
    archivees: compter("archivee"),
  };
}
