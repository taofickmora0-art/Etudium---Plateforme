import { demoModeActive } from "@/lib/auth/current-user";
import type { Badge, CouleurParcours, Niveau, StatutFormation } from "@/lib/contenus/libelles";
import { estTablesAbsentes, liste, parOrdre, TablesAbsentesError, texte, textes, un, verifier, type Ligne } from "@/lib/contenus/lecture";
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
} from "./types";

// Lecture des contenus pour le back-office. Les pages vérifient d'abord l'équipe (requireSpace) ; la base revérifie
// (règles d'accès de la 0004 : l'équipe voit aussi les brouillons et les archives).

export { estTablesAbsentes, TablesAbsentesError };

/** Un identifiant qui n'a pas la forme d'un uuid ne trouvera rien : on évite l'erreur de la base (page introuvable). */
const estUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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
  if (demoModeActive() || !estUuid(id)) return null;
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
  if (demoModeActive() || !estUuid(id)) return null;
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
  if (demoModeActive() || !estUuid(id)) return null;
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
  if (demoModeActive() || !estUuid(id)) return null;
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

