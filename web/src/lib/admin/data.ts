import { estLeconDeContenu } from "@/lib/catalogue/regles";
import type { TypeLecon } from "@/lib/catalogue/types";
import type { GenreExercice } from "@/lib/exercices/types";
import { estFournisseur } from "@/lib/video/plateformes";
import { demoModeActive } from "@/lib/auth/current-user";
import { etatFormation } from "@/lib/contenus/etat";
import type { Badge, CouleurParcours, Niveau, StatutFormation } from "@/lib/contenus/libelles";
import { cheminsImages, depuisMarkdown, documentLu } from "@/lib/lecon/document";
import { signerImages } from "@/lib/lecon/images";
import { versEtatEdition, versSaisieInfos, versSaisieLecon } from "@/lib/editeur/saisie";
import { estFonctionAbsente, estTablesAbsentes, lireAvecRepli, liste, parOrdre, TablesAbsentesError, texte, textes, un, verifier, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { versReseaux } from "@/lib/formateurs/reseaux";
import { versChiffresFormateurs, versChiffresFormations, type ChiffresFormateurs, type ChiffresFormations } from "./cartes-chiffres";
import { versFicheParcours, versStatistiquesParcours, type FicheParcoursDonnees, type StatistiquesParcours } from "./parcours-chiffres";
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
const COULEURS_PARCOURS: readonly string[] = ["academique", "digital", "business"];
/** La couleur du premier parcours d'une formation (couverture par défaut de sa carte). */
const couleurDuParcours = (f: Ligne): CouleurParcours | undefined => {
  const couleur = texte(un(liste(f.formations_parcours)[0]?.parcours)?.couleur);
  return COULEURS_PARCOURS.includes(couleur) ? (couleur as CouleurParcours) : undefined;
};

const COLONNES_PARCOURS = "id, slug, nom, nom_court, description, couleur, ordre, actif";
const COLONNES_FORMATEUR = "id, nom, titre, domaine, presentation";

export async function listParcours(): Promise<ParcoursAdmin[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lignes = verifier(await supabase.from("parcours").select(COLONNES_PARCOURS).order("ordre").order("cree_le"));
  return (lignes as Ligne[]).map(versParcours);
}

/** Les chiffres de la page Parcours (0065) ; null en démonstration ou sans la migration (la page le dit). */
export async function lireStatistiquesParcours(): Promise<StatistiquesParcours | null> {
  if (demoModeActive()) return null;
  const { data, error } = await (await createClient()).rpc("parcours_back_office");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture des chiffres des parcours impossible (${error.code ?? "?"}).`);
  }
  return versStatistiquesParcours(data);
}

/** La fiche d'un parcours (0066) ; null en démonstration ou sans la migration (la page le dit). */
export async function lireFicheParcours(id: string): Promise<FicheParcoursDonnees | null> {
  if (demoModeActive() || !estUuid(id)) return null;
  const { data, error } = await (await createClient()).rpc("parcours_detail_back_office", { p_parcours: id });
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture de la fiche du parcours impossible (${error.code ?? "?"}).`);
  }
  return data ? versFicheParcours(data) : null;
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

/** La fiche d'un formateur, avec ses réseaux (0070) ; sans la colonne, relue sans eux (réseaux vides). */
export async function getFormateur(id: string): Promise<FormateurAdmin | null> {
  if (demoModeActive() || !estUuid(id)) return null;
  const supabase = await createClient();
  const ligne = (await lireAvecRepli([`${COLONNES_FORMATEUR}, reseaux`, COLONNES_FORMATEUR], (colonnes) =>
    supabase.from("formateurs").select(colonnes).eq("id", id).maybeSingle(),
  )) as Ligne | null;
  return ligne ? { ...versFormateur(ligne), reseaux: versReseaux(ligne.reseaux) } : null;
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
type Client = Awaited<ReturnType<typeof createClient>>;

/** Les formations qui ont des brouillons (0056), lisibles par leurs éditeurs ; vide avant la 0056. */
async function formationsAvecBrouillons(supabase: Client): Promise<Set<string>> {
  const [formations, lecons] = await Promise.all([
    supabase.from("brouillons_formations").select("formation_id"),
    supabase.from("brouillons_lecons").select("lecon_id, lecons(modules(formation_id))"),
  ]);
  const ids = new Set<string>();
  if (!formations.error) for (const b of liste(formations.data)) ids.add(String(b.formation_id));
  if (!lecons.error) {
    for (const b of liste(lecons.data)) {
      const formation = un(un(un(b.lecons)?.modules))?.formation_id;
      if (typeof formation === "string") ids.add(formation);
    }
  }
  return ids;
}

/** Les leçons qui ont un brouillon (0056) parmi celles-ci ; vide avant la 0056. */
async function leconsAvecBrouillon(supabase: Client, lecons: string[]): Promise<Set<string>> {
  if (lecons.length === 0) return new Set();
  const { data, error } = await supabase.from("brouillons_lecons").select("lecon_id").in("lecon_id", lecons);
  return new Set(error ? [] : liste(data).map((b) => String(b.lecon_id)));
}

export async function listFormations(filtre?: { formateurId: string }): Promise<FormationResume[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  // Le type des leçons (0031) : « n leçons » ne compte pas les quiz. « colonnes de la formation|colonnes des leçons ».
  const relue = ", envoyee_le, renvoyee_le, modifiee_par_formateur_le";
  // La carte du back-office : résumé, couverture (0012), note (0010) et formateur ; repli sans elles. La date de
  // publication (0004) est de base : le menu des cartes ne propose « Supprimer » qu'aux formations jamais publiées.
  const carte = ", resume, couverture, note_moyenne, nb_avis, formateurs(nom)";
  const lignes = await lireAvecRepli([`${relue}${carte}|, type`, `${relue}|, type`, `${relue}|`, "|"], (variante) => {
    const [colonnes, lecons] = variante.split("|");
    const requete = supabase.from("formations").select(`id, slug, titre, statut, niveau, publiee_le${colonnes}, formations_parcours(parcours(nom_court, couleur)), modules(lecons(id${lecons}))`);
    return filtre ? requete.eq("formateur_id", filtre.formateurId).order("modifie_le", { ascending: false }) : requete.order("titre");
  });
  const avecBrouillons = await formationsAvecBrouillons(supabase);
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
      modificationsNonPubliees: avecBrouillons.has(String(f.id)),
      publieeLe: dateOuNull(f.publiee_le),
      resume: texte(f.resume),
      couverture: texte(f.couverture) || null,
      note: typeof f.note_moyenne === "number" || typeof f.note_moyenne === "string" ? Number(f.note_moyenne) || null : null,
      nbAvis: Number(f.nb_avis ?? 0) || 0,
      formateur: texte(un(f.formateurs)?.nom) || null,
      couleur: couleurDuParcours(f),
    };
  });
}

/** Les chiffres des cartes des formations (0068) ; null en démonstration ou sans la migration (cartes sans chiffres). */
export async function lireChiffresFormations(): Promise<ChiffresFormations | null> {
  if (demoModeActive()) return null;
  const { data, error } = await (await createClient()).rpc("formations_back_office");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture des chiffres des formations impossible (${error.code ?? "?"}).`);
  }
  return versChiffresFormations(data);
}

/** Les chiffres des cartes des formateurs (0068) ; null en démonstration ou sans la migration. */
export async function lireChiffresFormateurs(): Promise<ChiffresFormateurs | null> {
  if (demoModeActive()) return null;
  const { data, error } = await (await createClient()).rpc("formateurs_back_office");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture des chiffres des formateurs impossible (${error.code ?? "?"}).`);
  }
  return versChiffresFormateurs(data);
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
        `id, slug, titre, statut, niveau, resume, description, objectifs, competences, formateur_id, gratuite, badge, seuil_video, publiee_le${couverture}, ` +
          "formations_parcours(parcours_id, parcours(nom_court)), " +
          `modules(id, titre, ordre, lecons(id, titre, duree_secondes, apercu, ordre${statut}, lecons_contenus(video_id)))`,
      )
      .eq("id", id)
      .maybeSingle();
  })) as Ligne | null;
  if (!f) return null;
  const questions = await questionsParQuiz(supabase, id);
  const brouillons = await leconsAvecBrouillon(
    supabase,
    liste(f.modules).flatMap((m) => liste(m.lecons).map((l) => String(l.id))),
  );
  const modules = liste(f.modules)
    .map(versModule)
    .sort(parOrdre)
    .map((m) => ({
      ...m,
      lecons: m.lecons.map((l) => ({
        ...(l.type === "quiz" && l.id in questions ? { ...l, nbQuestions: questions[l.id] } : l),
        ...(brouillons.has(l.id) ? { brouillon: true } : {}),
      })),
    }));
  const { statut, etat, envoyeeLe, renvoyeeLe, modifieeParFormateurLe } = relecture(f);
  // Les informations générales dans l'éditeur (0056) : le brouillon s'il existe ; sans la fonction, rien.
  const reponseEdition = await supabase.rpc("edition_formation", { p_formation: id });
  const edition = !reponseEdition.error && reponseEdition.data ? versEtatEdition(reponseEdition.data, versSaisieInfos) : undefined;
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
    badge: (f.badge as Badge | null) ?? null,
    seuilVideo: Number(f.seuil_video ?? 90),
    scoreQuiz: f.score_quiz === undefined ? null : Number(f.score_quiz ?? 70),
    exercicesObligatoires: f.exercices_obligatoires === undefined ? null : f.exercices_obligatoires !== false,
    publieeLe: typeof f.publiee_le === "string" ? f.publiee_le : null,
    parcoursIds: liste(f.formations_parcours).map((lien) => String(lien.parcours_id)),
    modules,
    couverture: texte(f.couverture) || null,
    edition,
    modificationsNonPubliees: edition?.brouillon === true || brouillons.size > 0,
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

/** Le nombre d'étudiants qui suivent une formation (0059), pour la fenêtre « Désactiver » ; null s'il n'est pas lu. */
export async function nombreSuiveurs(formationId: string): Promise<number | null> {
  try {
    const { data, error } = await (await createClient()).rpc("nombre_suiveurs_formation", { p_formation: formationId });
    return error || typeof data !== "number" ? null : data;
  } catch {
    return null;
  }
}

export async function getLeconAdmin(id: string): Promise<LeconAdmin | null> {
  if (demoModeActive() || !estUuid(id)) return null;
  const supabase = await createClient();
  // Le statut et « Activer les commentaires » (0027) ; le programme de la formation donne la position et les voisines.
  // Le document riche (0055) en plus, avec son repli : chaque variante des colonnes, avec puis sans le document.
  const variantes = [", publiee, commentaires_actifs, type, genre_exercice", ", publiee, commentaires_actifs, type", ", publiee, commentaires_actifs", ""].flatMap((c) => [
    `${c}|, document`,
    `${c}|`,
  ]);
  const l = (await lireAvecRepli(variantes, (variante) => {
    const [colonnes, document] = variante.split("|");
    return supabase
      .from("lecons")
      .select(
        `id, module_id, titre, titre_court, duree_secondes, apercu, resume, points_cles${colonnes}, ` +
          "modules(formation_id, formations(titre, slug, modules(id, titre, ordre, lecons(id, ordre)))), " +
          `lecons_contenus(video_fournisseur, video_id, texte${document}), ` +
          "ressources(id, titre, fichier, format, taille_octets, telechargeable, ordre)",
      )
      .eq("id", id)
      .maybeSingle();
  })) as Ligne | null;
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
  // Une leçon ancienne (Markdown restreint, sans document) s'ouvre convertie ; elle est gardée au premier enregistrement.
  const document = documentLu(contenu?.document) ?? depuisMarkdown(texte(contenu?.texte));
  // Ce que l'éditeur affiche (0056) : le brouillon s'il existe ; sans la fonction (avant la 0056), rien.
  const reponseEdition = await supabase.rpc("edition_lecon", { p_lecon: id });
  const edition = !reponseEdition.error && reponseEdition.data ? versEtatEdition(reponseEdition.data, versSaisieLecon) : undefined;
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
    document,
    images: await signerImages(supabase, [...cheminsImages(document), ...(edition ? cheminsImages(edition.donnees.document) : [])]),
    edition,
    ressources: liste(l.ressources).map(versRessource).sort(parOrdre),
  };
}

