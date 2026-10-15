import { estLeconDeContenu } from "@/lib/catalogue/regles";
import type { TypeLecon } from "@/lib/catalogue/types";
import type { GenreExercice } from "@/lib/exercices/types";
import { estFournisseur } from "@/lib/video/plateformes";
import { demoModeActive } from "@/lib/auth/current-user";
import { etatFormation } from "@/lib/contenus/etat";
import type { Badge, CouleurParcours, Niveau, StatutFormation } from "@/lib/contenus/libelles";
import { estFonctionAbsente, estTablesAbsentes, lireAvecRepli, liste, parOrdre, TablesAbsentesError, texte, textes, un, verifier, type Ligne } from "@/lib/contenus/lecture";
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

const versTypeLecon = (valeur: unknown): TypeLecon => (valeur === "quiz" || valeur === "exercice" ? valeur : "lecon");
const versGenreExercice = (l: Ligne): GenreExercice | null =>
  l.type !== "exercice" ? null : l.genre_exercice === "simple" ? "simple" : l.genre_exercice === "rendu" ? "rendu" : null;

const versLeconResume = (l: Ligne): LeconResume & { ordre: number } => ({
  id: String(l.id),
  titre: texte(l.titre),
  dureeSecondes: Number(l.duree_secondes ?? 0),
  apercu: l.apercu === true,
  aVideo: Boolean(un(l.lecons_contenus)?.video_id),
  publiee: l.publiee !== false,
  type: versTypeLecon(l.type),
  genreExercice: versGenreExercice(l),
  ordre: Number(l.ordre ?? 0),
});

const sansOrdre = (lecon: LeconResume & { ordre: number }): LeconResume => ({
  id: lecon.id,
  titre: lecon.titre,
  dureeSecondes: lecon.dureeSecondes,
  apercu: lecon.apercu,
  aVideo: lecon.aVideo,
  publiee: lecon.publiee,
  type: lecon.type,
  genreExercice: lecon.genreExercice,
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

const dateOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);

/** État et relecture d'une ligne (colonnes de la 0014, absentes avant elle). */
function relecture(f: Ligne) {
  const statut = f.statut as StatutFormation;
  const envoyeeLe = dateOuNull(f.envoyee_le);
  const renvoyeeLe = dateOuNull(f.renvoyee_le);
  return { statut, etat: etatFormation({ statut, envoyeeLe, renvoyeeLe }), envoyeeLe, renvoyeeLe, modifieeParFormateurLe: dateOuNull(f.modifiee_par_formateur_le) };
}

/**
 * Les formations, par titre ; avec un filtre, celles d'une fiche formateur, les plus récemment modifiées d'abord
 * (espace formateur). Les colonnes de relecture (0014) sont facultatives.
 */
export async function listFormations(filtre?: { formateurId: string }): Promise<FormationResume[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  // Le type des leçons (0031) : « n leçons » ne compte pas les quiz. « colonnes de la formation|colonnes des leçons ».
  const relue = ", envoyee_le, renvoyee_le, modifiee_par_formateur_le";
  const lignes = await lireAvecRepli([`${relue}|, type`, `${relue}|`, "|"], (variante) => {
    const [colonnes, lecons] = variante.split("|");
    const requete = supabase.from("formations").select(`id, slug, titre, statut, niveau${colonnes}, formations_parcours(parcours(nom_court)), modules(lecons(id${lecons}))`);
    return filtre ? requete.eq("formateur_id", filtre.formateurId).order("modifie_le", { ascending: false }) : requete.order("titre");
  });
  return liste(lignes).map((f) => {
    const { statut, etat, modifieeParFormateurLe } = relecture(f);
    return {
      id: String(f.id),
      slug: texte(f.slug),
      titre: texte(f.titre),
      statut,
      niveau: f.niveau as Niveau,
      nbLecons: liste(f.modules).reduce((total, m) => total + liste(m.lecons).filter((l) => estLeconDeContenu({ type: texte(l.type) || undefined })).length, 0),
      parcours: nomsDesParcours(f),
      etat,
      modifieeParFormateurLe,
    };
  });
}

/** Le nombre de questions de chaque quiz d'une formation (0031) ; vide avant elle. */
async function questionsParQuiz(supabase: Awaited<ReturnType<typeof createClient>>, formationId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("questions_par_quiz", { p_formation: formationId });
  if (error) {
    if (estFonctionAbsente(error)) return {};
    throw new Error(`Lecture des quiz impossible : ${error.message ?? error.code}`);
  }
  return Object.fromEntries(Object.entries(un(data) ?? {}).map(([cle, valeur]) => [cle, Number(valeur) || 0]));
}

export async function getFormationAdmin(id: string): Promise<FormationAdmin | null> {
  if (demoModeActive() || !estUuid(id)) return null;
  const supabase = await createClient();
  // La couverture (0012) et la relecture (0014) sont facultatives : sans elles, le back-office s'ouvre quand même.
  // Le statut des leçons (0027) aussi : sans lui, les leçons sont toutes visibles, comme avant.
  // Le score minimal aux quiz et le type des leçons (0031) aussi.
  const variantes = [
    // Le genre des exercices (0032) et « Exercices obligatoires » (0033) aussi.
    [", couverture, envoyee_le, renvoyee_le, remarque_relecture, modifiee_par_formateur_le, score_quiz, exercices_obligatoires", ", publiee, type, genre_exercice"],
    [", couverture, envoyee_le, renvoyee_le, remarque_relecture, modifiee_par_formateur_le, score_quiz", ", publiee, type, genre_exercice"],
    [", couverture, envoyee_le, renvoyee_le, remarque_relecture, modifiee_par_formateur_le, score_quiz", ", publiee, type"],
    [", couverture, envoyee_le, renvoyee_le, remarque_relecture, modifiee_par_formateur_le", ", publiee"],
    [", couverture, envoyee_le, renvoyee_le, remarque_relecture, modifiee_par_formateur_le", ""],
    [", couverture", ""],
    ["", ""],
  ];
  const f = (await lireAvecRepli(variantes.map((v) => v.join("|")), (variante) => {
    const [couverture, statut] = variante.split("|");
    return supabase
      .from("formations")
      .select(
        `id, slug, titre, statut, niveau, resume, description, objectifs, competences, formateur_id, gratuite, achat_separe, prix_fcfa, badge, seuil_video, publiee_le${couverture}, ` +
          "formations_parcours(parcours_id, parcours(nom_court)), " +
          `modules(id, titre, ordre, lecons(id, titre, duree_secondes, apercu, ordre${statut}, lecons_contenus(video_id)))`,
      )
      .eq("id", id)
      .maybeSingle();
  })) as Ligne | null;
  if (!f) return null;
  const questions = await questionsParQuiz(supabase, id);
  const modules = liste(f.modules)
    .map(versModule)
    .sort(parOrdre)
    .map((m) => ({ ...m, lecons: m.lecons.map((l) => (l.type === "quiz" && l.id in questions ? { ...l, nbQuestions: questions[l.id] } : l)) }));
  const { statut, etat, envoyeeLe, renvoyeeLe, modifieeParFormateurLe } = relecture(f);
  return {
    id: String(f.id),
    slug: texte(f.slug),
    titre: texte(f.titre),
    statut,
    etat,
    envoyeeLe,
    renvoyeeLe,
    remarqueRelecture: texte(f.remarque_relecture) || null,
    modifieeParFormateurLe,
    niveau: f.niveau as Niveau,
    nbLecons: modules.reduce((total, m) => total + m.lecons.filter(estLeconDeContenu).length, 0),
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
    scoreQuiz: f.score_quiz === undefined ? null : Number(f.score_quiz ?? 70),
    exercicesObligatoires: f.exercices_obligatoires === undefined ? null : f.exercices_obligatoires !== false,
    publieeLe: typeof f.publiee_le === "string" ? f.publiee_le : null,
    parcoursIds: liste(f.formations_parcours).map((lien) => String(lien.parcours_id)),
    modules,
    couverture: texte(f.couverture) || null,
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
  // Le statut et « Activer les commentaires » (0027) ; le programme de la formation donne la position et les voisines.
  const l = (await lireAvecRepli([", publiee, commentaires_actifs, type, genre_exercice", ", publiee, commentaires_actifs, type", ", publiee, commentaires_actifs", ""], (colonnes) =>
    supabase
      .from("lecons")
      .select(
        `id, module_id, titre, titre_court, duree_secondes, apercu, resume, points_cles${colonnes}, ` +
          "modules(formation_id, formations(titre, slug, modules(id, titre, ordre, lecons(id, ordre)))), " +
          "lecons_contenus(video_fournisseur, video_id, texte), " +
          "ressources(id, titre, fichier, format, taille_octets, telechargeable, ordre)",
      )
      .eq("id", id)
      .maybeSingle(),
  )) as Ligne | null;
  if (!l) return null;
  const parent = un(l.modules);
  const contenu = un(l.lecons_contenus);
  const fournisseur = contenu?.video_fournisseur;
  const videoId = contenu?.video_id;
  const formation = un(parent?.formations);
  // La formation dans l'ordre : ses sections, puis leurs leçons.
  const programme = liste(formation?.modules)
    .map((m) => ({ id: String(m.id), titre: texte(m.titre), ordre: Number(m.ordre ?? 0), lecons: liste(m.lecons).map((x) => ({ id: String(x.id), ordre: Number(x.ordre ?? 0) })).sort(parOrdre) }))
    .sort(parOrdre);
  const suite = programme.flatMap((m) => m.lecons.map((x) => x.id));
  const rang = suite.indexOf(String(l.id)) + 1;
  const rangModule = programme.findIndex((m) => m.id === String(l.module_id));
  return {
    id: String(l.id),
    moduleId: String(l.module_id),
    formationId: String(parent?.formation_id ?? ""),
    formationTitre: texte(formation?.titre),
    formationSlug: texte(formation?.slug),
    publiee: l.publiee !== false,
    commentairesActifs: l.commentaires_actifs !== false,
    type: versTypeLecon(l.type),
    genreExercice: versGenreExercice(l),
    position: { rang: Math.max(rang, 1), total: Math.max(suite.length, 1), module: { rang: rangModule + 1 || 1, titre: programme[rangModule]?.titre ?? "" } },
    voisines: { precedente: rang > 1 ? suite[rang - 2] : null, suivante: rang > 0 && rang < suite.length ? suite[rang] : null },
    titre: texte(l.titre),
    titreCourt: typeof l.titre_court === "string" ? l.titre_court : null,
    dureeSecondes: Number(l.duree_secondes ?? 0),
    apercu: l.apercu === true,
    resume: texte(l.resume),
    pointsCles: textes(l.points_cles),
    video: estFournisseur(fournisseur) && typeof videoId === "string" ? { fournisseur, id: videoId } : null,
    texte: texte(contenu?.texte),
    ressources: liste(l.ressources).map(versRessource).sort(parOrdre),
  };
}

