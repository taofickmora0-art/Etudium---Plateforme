"use server";

import { refresh } from "next/cache";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrorsFrom, type FormState } from "@/lib/auth/schemas";
import type { createClient } from "@/lib/supabase/server";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { cheminValide } from "@/lib/couvertures/regles";
import { baseFormations, espaceDe, type EspaceEdition } from "./espace";
import { ACCES_EQUIPE, exigerDomaine, exigerEditeur } from "./garde";
import { formatParMime } from "./fichiers";
import { formateurSchema, formationInfosSchema, leconSchema, moduleSchema, parcoursSchema, reseauxDeLaSaisie, ressourceSchema } from "./schemas";
import { CLES_RESEAUX } from "@/lib/formateurs/reseaux";
import { slugify } from "./slug";
import { MIGRATION_QUIZ } from "@/lib/quiz/conversion";
import { MIGRATION_EXERCICES } from "@/lib/exercices/conversion";
import { MIGRATION_CERTIFICATS } from "@/lib/certificats/conversion";
import { estLeconDeContenu } from "@/lib/catalogue/regles";
import { viderFileApres } from "@/lib/envois/declencher";

// Actions serveur du back-office (spec du lot 1, §10). Chacune revérifie qui demande : l'équipe (exigerEquipe) ou,
// pour le contenu des formations, l'équipe ou un formateur (exigerEditeur, spec de l'espace formateur) ; puis la base
// revérifie encore (règles d'accès de la 0004 et de la 0014 : un formateur n'écrit que dans ses formations).

const ECHEC = authErrorMessage(null);
const ADRESSE_PRISE = "Cette adresse est déjà prise.";
const ADRESSE_PRISE_ENTRE_TEMPS = "Une autre formation vient de prendre cette adresse : réessayez.";
const DEPLACEMENT_ECHOUE = "Le déplacement n’a pas abouti.";
const FORMATION_VIDE = "Publiez au moins une leçon avant de publier la formation.";
const MIGRATION_LECONS = "Appliquez la migration 0027 (guide « Ce qui te revient », section 33).";
const MIGRATION_MONETISATION = "Appliquez la migration 0048 (guide « Ce qui te revient », section 54).";
const MIGRATION_RESEAUX = "Les réseaux ne peuvent pas encore être enregistrés : appliquez la migration 0070 (guide « Ce qui te revient », section 69), ou videz ces champs.";
/** Une table absente de la base (migration pas encore appliquée). */
const tableAbsente = (erreur: { code?: string } | null) => erreur?.code === "42P01" || erreur?.code === "PGRST205";
const PUBLIEE_ARCHIVER = "Une formation publiée s’archive, elle ne s’efface pas.";

type Resultat = { ok: boolean; message?: string; redirection?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const estUuid = (id: string) => UUID.test(id);
/** Les messages des règles de la base sont écrits avec l'apostrophe droite ; l'interface utilise l'apostrophe typographique. */
const typographie = (message: string) => message.replace(/'/g, "’");

const texte = (fd: FormData, nom: string) => String(fd.get(nom) ?? "");
const coche = (fd: FormData, nom: string) => fd.get(nom) === "on";
const enTextes = (valeurs: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(valeurs).map(([cle, v]) => [cle, typeof v === "boolean" ? (v ? "on" : "") : String(v ?? "")]));

type ErreurBase = { code?: string; message?: string };
/** Une colonne d'une migration pas encore appliquée, à l'écriture (Postgres 42703, PostgREST PGRST204). */
const colonneAbsente = (erreur: ErreurBase | null | undefined) => erreur?.code === "42703" || erreur?.code === "PGRST204";
type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Erreur de la base traduite pour le formulaire : adresse déjà prise, règle de la base (message en français), sinon générique. */
function erreurEnregistrement(erreur: ErreurBase, values: Record<string, string>): FormState {
  if (erreur.code === "23505") return { status: "error", fieldErrors: { slug: ADRESSE_PRISE }, values };
  if (erreur.code === "P0001" && erreur.message) return { status: "error", message: erreur.message, values };
  return { status: "error", message: ECHEC, values };
}

/** Prochain rang d'une liste (à la fin). */
async function rangSuivant(supabase: Supabase, table: string, filtre?: [string, string]): Promise<number> {
  const base = supabase.from(table).select("ordre");
  const { data } = await (filtre ? base.eq(filtre[0], filtre[1]) : base).order("ordre", { ascending: false }).limit(1).maybeSingle();
  return Number((data as { ordre?: number } | null)?.ordre ?? 0) + 1;
}

// ─── Parcours ───────────────────────────────────────────────────────────────

export async function saveParcours(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = texte(fd, "id");
  const nom = texte(fd, "nom");
  const saisie = {
    nom,
    nom_court: texte(fd, "nom_court"),
    slug: texte(fd, "slug").trim() || slugify(nom),
    description: texte(fd, "description"),
    couleur: texte(fd, "couleur"),
    actif: coche(fd, "actif"),
  };
  const values = enTextes(saisie);
  const parsed = parcoursSchema.safeParse(saisie);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    const garde = await exigerDomaine("contenus");
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    if (id) {
      const { error } = await supabase.from("parcours").update(parsed.data).eq("id", id);
      if (error) return erreurEnregistrement(error, values);
    } else {
      const ordre = await rangSuivant(supabase, "parcours");
      const { error } = await supabase.from("parcours").insert({ ...parsed.data, ordre });
      if (error) return erreurEnregistrement(error, values);
    }
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  if (!id) return { status: "success", redirection: "/admin/parcours" };
  refresh();
  return { status: "success", values };
}

// ─── Formateurs ─────────────────────────────────────────────────────────────

export async function saveFormateur(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = texte(fd, "id");
  const saisie = {
    nom: texte(fd, "nom"),
    titre: texte(fd, "titre"),
    domaine: texte(fd, "domaine"),
    presentation: texte(fd, "presentation"),
    ...Object.fromEntries(CLES_RESEAUX.map((cle) => [cle, texte(fd, cle)])),
  };
  const values = enTextes(saisie);
  const parsed = formateurSchema.safeParse(saisie);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const { nom, titre, domaine, presentation } = parsed.data;
  const fiche = { nom, titre, domaine, presentation };
  const reseaux = reseauxDeLaSaisie(parsed.data);

  try {
    const garde = await exigerDomaine("contenus");
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    const ecrire = (valeurs: typeof fiche & { reseaux?: typeof reseaux }) =>
      id ? supabase.from("formateurs").update(valeurs).eq("id", id) : supabase.from("formateurs").insert(valeurs);
    let { error } = await ecrire({ ...fiche, reseaux });
    // Sans la 0070, la colonne manque : la fiche s'enregistre sans les réseaux, s'il n'y en a aucun à garder.
    if (colonneAbsente(error)) {
      if (Object.keys(reseaux).length > 0) return { status: "error", message: MIGRATION_RESEAUX, values };
      ({ error } = await ecrire(fiche));
    }
    if (error) return erreurEnregistrement(error, values);
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  if (!id) return { status: "success", redirection: "/admin/formateurs" };
  refresh();
  return { status: "success", values };
}

// ─── Ordre des éléments ─────────────────────────────────────────────────────

const TABLES_ORDONNEES = ["parcours", "modules", "lecons", "ressources"] as const;
export type TableOrdonnee = (typeof TABLES_ORDONNEES)[number];

/** Monte (-1) ou descend (1) un élément dans sa liste (fonction deplacer de la migration 0005). */
export async function deplacer(table: TableOrdonnee, id: string, sens: -1 | 1): Promise<{ ok: boolean; message?: string }> {
  if (!TABLES_ORDONNEES.includes(table) || (sens !== -1 && sens !== 1) || !id) return { ok: false, message: DEPLACEMENT_ECHOUE };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    // L'ordre des parcours revient à l'équipe ; celui du programme d'une formation, aussi à son formateur.
    if (table === "parcours" && !garde.equipe) return { ok: false, message: ACCES_EQUIPE };
    const { error } = await garde.supabase.rpc("deplacer", { p_table: table, p_id: id, p_sens: sens });
    if (error) return { ok: false, message: DEPLACEMENT_ECHOUE };
  } catch {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  refresh();
  return { ok: true };
}

/**
 * Range un parcours à un rang (1 = en tête), par glisser-déposer sur la page Parcours (demande du 2 novembre 2026) :
 * autant de crans que nécessaire avec la fonction deplacer de la base. L'équipe seulement.
 */
export async function rangerParcours(id: string, position: number): Promise<{ ok: boolean; message?: string }> {
  if (!estUuid(id) || !Number.isInteger(position) || position < 1) return { ok: false, message: DEPLACEMENT_ECHOUE };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    if (!garde.equipe) return { ok: false, message: ACCES_EQUIPE };
    const { data, error } = await garde.supabase.from("parcours").select("id").order("ordre").order("cree_le");
    if (error || !Array.isArray(data)) return { ok: false, message: DEPLACEMENT_ECHOUE };
    const ids = (data as { id: string }[]).map((p) => p.id);
    const depart = ids.indexOf(id);
    if (depart < 0) return { ok: false, message: DEPLACEMENT_ECHOUE };
    const arrivee = Math.min(position, ids.length) - 1;
    const sens = arrivee < depart ? -1 : 1;
    for (let i = 0; i < Math.abs(arrivee - depart); i++) {
      const { error: refus } = await garde.supabase.rpc("deplacer", { p_table: "parcours", p_id: id, p_sens: sens });
      if (refus) return { ok: false, message: DEPLACEMENT_ECHOUE };
    }
  } catch {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  refresh();
  return { ok: true };
}

const MIGRATION_FICHE_PARCOURS = "Appliquez la migration 0066 (guide « Ce qui te revient », section 65).";

/** Une action de la fiche d'un parcours (0066) : l'équipe seulement ; le refus de la base est rendu tel quel. */
async function actionFicheParcours(fonction: string, args: Record<string, unknown>): Promise<{ ok: boolean; message?: string }> {
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    if (!garde.equipe) return { ok: false, message: ACCES_EQUIPE };
    const { error } = await garde.supabase.rpc(fonction, args);
    if (error) {
      if (estFonctionAbsente(error)) return { ok: false, message: MIGRATION_FICHE_PARCOURS };
      return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : DEPLACEMENT_ECHOUE };
    }
  } catch {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  refresh();
  return { ok: true };
}

/** Range une formation à un rang de son parcours (glisser-déposer de la fiche du parcours). */
export async function rangerFormationParcours(parcours: string, formation: string, position: number): Promise<{ ok: boolean; message?: string }> {
  if (!estUuid(parcours) || !estUuid(formation) || !Number.isInteger(position) || position < 1) return { ok: false, message: DEPLACEMENT_ECHOUE };
  return actionFicheParcours("ranger_formation_parcours", { p_parcours: parcours, p_formation: formation, p_position: position });
}

/** Fait passer une formation d'un parcours à un autre (en fin du parcours d'arrivée). */
export async function changerParcoursFormation(formation: string, depuis: string, vers: string): Promise<{ ok: boolean; message?: string }> {
  if (![formation, depuis, vers].every(estUuid)) return { ok: false, message: DEPLACEMENT_ECHOUE };
  return actionFicheParcours("changer_parcours_formation", { p_formation: formation, p_depuis: depuis, p_vers: vers });
}

/** Ajoute une formation existante au parcours, en fin. */
export async function ajouterFormationParcours(parcours: string, formation: string): Promise<{ ok: boolean; message?: string }> {
  if (!estUuid(parcours) || !estUuid(formation)) return { ok: false, message: DEPLACEMENT_ECHOUE };
  return actionFicheParcours("ajouter_formation_parcours", { p_parcours: parcours, p_formation: formation });
}

/**
 * Range une section ou une leçon à un rang (1 = en tête), une leçon pouvant changer de section dans sa formation
 * (fonction ranger de la migration 0027 : glisser-déposer et « Déplacer vers… » de l'onglet Leçons).
 */
export async function ranger(table: "modules" | "lecons", id: string, parent: string | null, position: number): Promise<Resultat> {
  if ((table !== "modules" && table !== "lecons") || !estUuid(id) || (parent !== null && !estUuid(parent)) || !Number.isInteger(position) || position < 1) {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.rpc("ranger", { p_table: table, p_id: id, p_parent: parent, p_position: position });
    if (error) {
      if (estFonctionAbsente(error)) return { ok: false, message: MIGRATION_LECONS };
      return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : DEPLACEMENT_ECHOUE };
    }
  } catch {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  refresh();
  return { ok: true };
}

// ─── Formations ─────────────────────────────────────────────────────────────

/** Essais d'adresse à la création : une adresse peut être prise par un brouillon que le formateur ne voit pas. */
const ESSAIS_ADRESSE = 10;

/** Nouvelle formation en brouillon ; son adresse vient du titre, avec « -2 », « -3 »… si elle est déjà prise. */
export async function createFormation(_prev: FormState, fd: FormData): Promise<FormState> {
  const espace = espaceDe(fd);
  const values = { titre: texte(fd, "titre") };
  const parsed = formationInfosSchema.pick({ titre: true }).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    const base = slugify(parsed.data.titre) || "formation";
    // n-ième adresse candidate : la base, puis « base-2 », « base-3 »… raccourcie pour rester sous 80 caractères.
    const candidate = (n: number) => {
      if (n === 1) return base;
      const suffixe = `-${n}`;
      return base.slice(0, 80 - suffixe.length).replace(/-+$/, "") + suffixe;
    };
    // Le début commun à toutes les candidates, pour retrouver aussi les versions raccourcies déjà prises.
    const { data: prises } = await supabase.from("formations").select("slug").like("slug", `${base.slice(0, 70)}%`);
    const utilisees = new Set(((prises as { slug: string }[] | null) ?? []).map((p) => p.slug));
    let n = 1;
    while (utilisees.has(candidate(n))) n++;
    // Adresse déjà prise (par un brouillon invisible pour un formateur, ou créée entre-temps) : la suivante.
    for (let essai = 0; essai < ESSAIS_ADRESSE; essai++, n++) {
      const { data, error } = await supabase.from("formations").insert({ titre: parsed.data.titre, slug: candidate(n) }).select("id").single();
      if (error?.code === "23505") continue;
      if (error || !data) return erreurEnregistrement(error ?? {}, values);
      return { status: "success", redirection: `${baseFormations(espace)}/${(data as { id: string }).id}` };
    }
    // Le formulaire n'a qu'un champ, le titre.
    return { status: "error", fieldErrors: { titre: ADRESSE_PRISE_ENTRE_TEMPS }, values };
  } catch {
    return { status: "error", message: ECHEC, values };
  }
}

/**
 * La carte « Réglages » de l'onglet Informations. Le contenu (titre, résumé, description, objectifs, compétences, niveau)
 * s'enregistre seul, à part (fin du lot 4, lib/editeur). Le formateur n'y règle que l'adresse (spec de l'espace
 * formateur, §1) ; l'équipe, aussi le reste.
 */
const reglagesSchema = formationInfosSchema.omit({ titre: true, resume: true, description: true, objectifs: true, competences: true, niveau: true });
const reglagesFormateurSchema = formationInfosSchema.pick({ slug: true });

const SCORE_QUIZ = "Score minimal entre 0 et 100 %.";

/** Les réglages d'une formation, puis ses parcours (ajoutés en fin de liste, retirés s'ils sont décochés). */
export async function saveFormationInfos(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = texte(fd, "id");
  // Le titre en ligne : il donne l'adresse quand le champ est vidé.
  const titre = texte(fd, "titre");
  const parcoursCoches = [...new Set(fd.getAll("parcours").map(String).filter(estUuid))];
  // Les compétences qu'une formation Business apprend à vendre (0048) : seulement si le formulaire montre la rubrique.
  const monetisation = fd.has("monetisation");
  const vendues = [...new Set(fd.getAll("competences_vendues").map(String).filter(estUuid))];
  const saisie = {
    slug: texte(fd, "slug").trim() || slugify(titre),
    formateur_id: texte(fd, "formateur_id") || null,
    gratuite: coche(fd, "gratuite"),
    badge: texte(fd, "badge") || null,
    seuil_video: Number(texte(fd, "seuil_video")),
  };
  // Le score minimal aux quiz (0031) : un réglage pédagogique, du formateur comme de l'équipe ; envoyé s'il est saisi.
  const scoreSaisi = fd.has("score_quiz") ? texte(fd, "score_quiz").trim() : null;
  const scoreQuiz = scoreSaisi === null ? null : Number(scoreSaisi);
  // « Exercices obligatoires » (0033) : une case à cocher, envoyée seulement si la carte « Certification » l'affiche.
  const obligatoires = fd.has("certification") ? coche(fd, "exercices_obligatoires") : null;
  const values = {
    ...enTextes({ ...saisie, seuil_video: texte(fd, "seuil_video") }),
    parcours: parcoursCoches.join(","),
    competences_vendues: vendues.join(","),
  };
  let garde: Awaited<ReturnType<typeof exigerEditeur>>;
  try {
    garde = await exigerEditeur();
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
  // Depuis l'espace formateur (ou pour un formateur), seulement le contenu : les réglages commerciaux et le formateur
  // attribué reviennent à l'équipe, et ce formulaire ne les envoie pas (un membre de l'équipe peut aussi être formateur).
  const complet = garde.equipe && espaceDe(fd) === "admin";
  const parsed = complet ? reglagesSchema.safeParse(saisie) : reglagesFormateurSchema.safeParse(saisie);
  const scoreInvalide = scoreQuiz !== null && (scoreSaisi === "" || !Number.isInteger(scoreQuiz) || scoreQuiz < 0 || scoreQuiz > 100);
  if (!parsed.success || scoreInvalide) {
    const erreurs = parsed.success ? {} : fieldErrorsFrom(parsed.error);
    if (scoreInvalide) erreurs.score_quiz = SCORE_QUIZ;
    return { status: "error", fieldErrors: erreurs, values: { ...values, score_quiz: scoreSaisi ?? "" } };
  }
  if (!estUuid(id)) return { status: "error", message: ECHEC, values };

  let scoreAbsent = false;
  let obligatoiresAbsent = false;
  try {
    const { supabase } = garde;
    const avecScore = scoreQuiz === null ? parsed.data : { ...parsed.data, score_quiz: scoreQuiz };
    let { error } = await supabase.from("formations").update(obligatoires === null ? avecScore : { ...avecScore, exercices_obligatoires: obligatoires }).eq("id", id);
    // Avant la 0033, puis avant la 0031 : le reste s'enregistre, et le champ concerné le dit.
    if (obligatoires !== null && colonneAbsente(error)) {
      obligatoiresAbsent = true;
      ({ error } = await supabase.from("formations").update(avecScore).eq("id", id));
    }
    if (scoreQuiz !== null && colonneAbsente(error)) {
      scoreAbsent = true;
      ({ error } = await supabase.from("formations").update(parsed.data).eq("id", id));
    }
    if (error) {
      // Règle de la base : l'adresse d'une formation publiée ne change plus.
      if (error.code === "P0001" && /adresse/i.test(error.message ?? "")) {
        return { status: "error", fieldErrors: { slug: typographie(error.message ?? "") }, values };
      }
      return erreurEnregistrement(error, values);
    }

    const { data: liens, error: erreurLiens } = await supabase.from("formations_parcours").select("parcours_id").eq("formation_id", id);
    if (erreurLiens) return erreurEnregistrement(erreurLiens, values);
    const existants = ((liens as { parcours_id: string }[] | null) ?? []).map((l) => l.parcours_id);
    const retires = existants.filter((p) => !parcoursCoches.includes(p));
    if (retires.length > 0) {
      const { error: e } = await supabase.from("formations_parcours").delete().eq("formation_id", id).in("parcours_id", retires);
      if (e) return erreurEnregistrement(e, values);
    }
    for (const parcoursId of parcoursCoches.filter((p) => !existants.includes(p))) {
      const ordre = await rangSuivant(supabase, "formations_parcours", ["parcours_id", parcoursId]);
      const { error: e } = await supabase.from("formations_parcours").insert({ formation_id: id, parcours_id: parcoursId, ordre });
      if (e) return erreurEnregistrement(e, values);
    }

    if (monetisation) {
      const refusMonetisation = await enregistrerMonetisation(supabase, id, parcoursCoches, vendues);
      if (refusMonetisation) return { status: "error", fieldErrors: { competences_vendues: refusMonetisation }, values };
    }
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  refresh();
  if (scoreAbsent || obligatoiresAbsent) {
    return {
      status: "error",
      fieldErrors: { ...(scoreAbsent ? { score_quiz: MIGRATION_QUIZ } : {}), ...(obligatoiresAbsent ? { exercices_obligatoires: MIGRATION_CERTIFICATS } : {}) },
      values,
    };
  }
  return { status: "success", values };
}

/**
 * Les compétences qu'une formation Business apprend à vendre (0048 ; restructuration, §5.3) : liées si elle est dans le
 * parcours Business, sinon toutes déliées. La base revérifie (une compétence publiée de Compétences digitales). Renvoie
 * le message à afficher sous la rubrique, ou null.
 */
async function enregistrerMonetisation(supabase: Supabase, id: string, parcoursCoches: string[], vendues: string[]): Promise<string | null> {
  let business = false;
  if (parcoursCoches.length > 0) {
    const { data, error } = await supabase.from("parcours").select("id").in("id", parcoursCoches).eq("couleur", "business");
    if (error) return ECHEC;
    business = ((data as unknown[] | null) ?? []).length > 0;
  }
  const cibles = business ? vendues : [];
  const { data: actuels, error } = await supabase.from("formations_monetisation").select("competence_id").eq("business_id", id);
  if (error) return tableAbsente(error) ? MIGRATION_MONETISATION : ECHEC;
  const existantes = ((actuels as { competence_id: string }[] | null) ?? []).map((l) => l.competence_id);
  const retirees = existantes.filter((c) => !cibles.includes(c));
  if (retirees.length > 0) {
    const { error: e } = await supabase.from("formations_monetisation").delete().eq("business_id", id).in("competence_id", retirees);
    if (e) return ECHEC;
  }
  const ajoutees = cibles.filter((c) => !existantes.includes(c));
  if (ajoutees.length > 0) {
    const { error: e } = await supabase.from("formations_monetisation").insert(ajoutees.map((c) => ({ business_id: id, competence_id: c })));
    if (e) return e.code === "P0001" && e.message ? typographie(e.message) : ECHEC;
  }
  return null;
}

/**
 * Publier (au moins une leçon), archiver, republier, désactiver ou réactiver une formation. La base garde les passages
 * permis (0059 : seule une formation publiée se désactive ; une formation désactivée redevient publiée).
 */
export async function setStatutFormation(id: string, statut: "publiee" | "archivee" | "desactivee"): Promise<Resultat> {
  if (!estUuid(id) || !["publiee", "archivee", "desactivee"].includes(statut)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerDomaine("contenus");
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    if (statut === "publiee") {
      // Au moins une leçon de contenu publiée (0027) : un quiz seul ne suffit pas (0031). Avant la 0027, toutes les
      // leçons sont visibles ; avant la 0031, elles sont toutes des leçons de contenu.
      let lecture: { data: unknown; error: ErreurBase | null } = await supabase.from("modules").select("id, lecons(id, publiee, type)").eq("formation_id", id);
      if (colonneAbsente(lecture.error)) lecture = await supabase.from("modules").select("id, lecons(id, publiee)").eq("formation_id", id);
      if (colonneAbsente(lecture.error)) lecture = await supabase.from("modules").select("id, lecons(id)").eq("formation_id", id);
      if (lecture.error) return { ok: false, message: ECHEC };
      const modules = (lecture.data as { lecons?: { publiee?: boolean; type?: string }[] }[] | null) ?? [];
      const lecons = modules.reduce((total, m) => total + (m.lecons ?? []).filter((l) => l.publiee !== false && estLeconDeContenu(l)).length, 0);
      if (lecons === 0) return { ok: false, message: FORMATION_VIDE };
    }
    const { error } = await supabase.from("formations").update({ statut }).eq("id", id);
    // Avant la 0059, l'état « desactivee » n'existe pas (valeur d'énumération refusée, 22P02).
    if (error?.code === "22P02" && statut === "desactivee") return { ok: false, message: "Appliquez la migration 0059 (guide « Ce qui te revient », section 60)." };
    if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  // Désactiver, réactiver ou archiver prévient ceux qui suivent la formation (0016, 0059) : push et e-mails partent.
  viderFileApres();
  return { ok: true };
}

/** Supprime un brouillon et ses fichiers. Une formation déjà publiée (même archivée) ne s'efface pas (spec §10). */
export async function deleteFormation(id: string, espace: EspaceEdition = "admin"): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: formation } = await supabase.from("formations").select("statut, publiee_le").eq("id", id).maybeSingle();
    if (!formation) return { ok: false, message: ECHEC };
    if ((formation as { publiee_le: string | null }).publiee_le) return { ok: false, message: PUBLIEE_ARCHIVER };
    // Les fichiers de la formation vivent dans son dossier « <id>/ » des espaces ressources et couvertures. Ils sont
    // retirés avant la ligne : ensuite, le dossier n'appartiendrait plus à aucune formation et un formateur ne pourrait
    // plus les supprimer (règles de la 0014). Le brouillon vient d'être vérifié : sa suppression ne sera pas refusée.
    for (const espaceFichiers of ["ressources", "couvertures"] as const) {
      const { data: fichiers } = await supabase.storage.from(espaceFichiers).list(id, { limit: 1000 });
      const chemins = ((fichiers as { name: string }[] | null) ?? []).map((f) => `${id}/${f.name}`);
      if (chemins.length > 0) await supabase.storage.from(espaceFichiers).remove(chemins);
    }
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  return { ok: true, redirection: baseFormations(espace === "formateur" ? "formateur" : "admin") };
}

// ─── Programme : modules et leçons ──────────────────────────────────────────

/** Retire du stockage les fichiers des ressources supprimées (après la ligne : voir deleteFormation). */
/**
 * Les fichiers rendus par les étudiants (0032) de ces leçons, retirés avant de les supprimer : après, la règle de
 * l'espace « rendus » ne laisserait plus le correcteur les effacer. Avant la 0032, il n'y a rien à retirer.
 */
async function retirerRendus(supabase: Supabase, lecons: string[]) {
  if (lecons.length === 0) return;
  const { data, error } = await supabase.rpc("fichiers_rendus", { p_lecons: lecons });
  const chemins = error ? [] : ((data as string[] | null) ?? []).filter(Boolean);
  if (chemins.length > 0) await supabase.storage.from("rendus").remove(chemins);
}

async function retirerFichiers(supabase: Supabase, fichiers: unknown) {
  const chemins = ((fichiers as { fichier: string }[] | null) ?? []).map((r) => r.fichier).filter(Boolean);
  if (chemins.length > 0) await supabase.storage.from("ressources").remove(chemins);
}

export async function addModule(_prev: FormState, fd: FormData): Promise<FormState> {
  const formationId = texte(fd, "formation_id");
  const values = { titre: texte(fd, "titre") };
  const parsed = moduleSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!estUuid(formationId)) return { status: "error", message: ECHEC, values };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    const ordre = await rangSuivant(supabase, "modules", ["formation_id", formationId]);
    const { error } = await supabase.from("modules").insert({ formation_id: formationId, titre: parsed.data.titre, ordre });
    if (error) return erreurEnregistrement(error, values);
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  refresh();
  return { status: "success" };
}

export async function renameModule(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = texte(fd, "id");
  const values = { titre: texte(fd, "titre") };
  const parsed = moduleSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!estUuid(id)) return { status: "error", message: ECHEC, values };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { error } = await garde.supabase.from("modules").update({ titre: parsed.data.titre }).eq("id", id);
    if (error) return erreurEnregistrement(error, values);
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  refresh();
  return { status: "success", values };
}

/** Supprime un module : ses leçons partent avec lui (cascade), puis les fichiers de leurs ressources. */
export async function deleteModule(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: fichiers } = await supabase.from("ressources").select("fichier, lecons!inner(module_id)").eq("lecons.module_id", id);
    const { data: lecons } = await supabase.from("lecons").select("id").eq("module_id", id);
    await retirerRendus(supabase, ((lecons as { id: string }[] | null) ?? []).map((l) => l.id));
    const { error } = await supabase.from("modules").delete().eq("id", id);
    if (error) return { ok: false, message: ECHEC };
    await retirerFichiers(supabase, fichiers);
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/**
 * Nouvelle leçon à la fin du module, avec son contenu vide ; on ouvre ensuite sa page. Dans une formation déjà publiée,
 * elle naît en brouillon (0027) : les étudiants ne la voient qu'une fois publiée. Dans une formation jamais publiée, tout
 * est encore caché : elle naît publiée, pour ne pas avoir à publier chaque leçon en plus de la formation.
 */
export async function addLecon(_prev: FormState, fd: FormData): Promise<FormState> {
  const espace = espaceDe(fd);
  const moduleId = texte(fd, "module_id");
  // Une leçon de contenu, un quiz (0031) ou un exercice (0032) ; une leçon ordinaire ne précise pas son type.
  const saisi = texte(fd, "type");
  const type = saisi === "quiz" || saisi === "exercice" ? saisi : null;
  const values = { titre: texte(fd, "titre") };
  const parsed = leconSchema.pick({ titre: true }).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!estUuid(moduleId)) return { status: "error", message: ECHEC, values };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    const { data: module } = await supabase.from("modules").select("formation_id, formations(publiee_le)").eq("id", moduleId).maybeSingle();
    const ligne = module as { formation_id?: string; formations?: { publiee_le?: string | null } | { publiee_le?: string | null }[] } | null;
    const formationId = ligne?.formation_id;
    if (!formationId) return { status: "error", message: ECHEC, values };
    const formation = Array.isArray(ligne?.formations) ? ligne.formations[0] : ligne?.formations;
    const ordre = await rangSuivant(supabase, "lecons", ["module_id", moduleId]);
    // Un exercice naît « avec rendu » (0032) ; l'envoyer révèle aussi une base sans la 0032.
    const nouvelle = { module_id: moduleId, titre: parsed.data.titre, ordre, ...(type ? { type } : {}), ...(type === "exercice" ? { genre_exercice: "rendu" } : {}) };
    // Un quiz ou un exercice naît en brouillon : on le publie une fois ses questions ou sa consigne écrites.
    let reponse = await supabase.from("lecons").insert({ ...nouvelle, publiee: type ? false : !formation?.publiee_le }).select("id").single();
    if (colonneAbsente(reponse.error)) {
      // Un quiz demande la 0031 ; une leçon, avant la 0027, s'ajoute sans statut (visible comme avant).
      if (type === "exercice") return { status: "error", message: MIGRATION_EXERCICES, values };
      if (type) return { status: "error", message: MIGRATION_QUIZ, values };
      reponse = await supabase.from("lecons").insert(nouvelle).select("id").single();
    }
    const { data, error } = reponse;
    if (error || !data) return erreurEnregistrement(error ?? {}, values);
    const leconId = (data as { id: string }).id;
    // Le contenu (vidéo, texte) vit à part : il ne se montre qu'avec l'accès à la leçon. Créé vide ici, complété ensuite.
    await supabase.from("lecons_contenus").insert({ lecon_id: leconId });
    return { status: "success", redirection: `${baseFormations(espace)}/${formationId}/lecons/${leconId}` };
  } catch {
    return { status: "error", message: ECHEC, values };
  }
}

/** Publie une leçon ou la remet en brouillon (0027) : les étudiants ne voient que les leçons publiées. */
export async function changerStatutLecon(id: string, publiee: boolean): Promise<Resultat> {
  if (!estUuid(id) || typeof publiee !== "boolean") return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.from("lecons").update({ publiee }).eq("id", id);
    // « Ajoutez au moins une question avant de publier ce quiz. » (0031)
    if (error) return { ok: false, message: colonneAbsente(error) ? MIGRATION_LECONS : error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Supprime une leçon (contenu et ressources en cascade), puis les fichiers de ses ressources. */
export async function deleteLecon(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: fichiers } = await supabase.from("ressources").select("fichier").eq("lecon_id", id);
    await retirerRendus(supabase, [id]);
    const { error } = await supabase.from("lecons").delete().eq("id", id);
    if (error) return { ok: false, message: ECHEC };
    await retirerFichiers(supabase, fichiers);
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

// ─── Ressources d'une leçon ─────────────────────────────────────────────────
// Le fichier est envoyé par le navigateur directement dans l'espace « ressources » (jusqu'à 50 Mo, au-delà de ce que
// permet une action serveur) ; la règle de stockage de la 0004 n'y autorise que l'équipe. On enregistre ensuite sa ligne.

const HORS_DOSSIER = "Ce fichier n’est pas dans le dossier de la formation.";
const TITRE_FICHIER = "Entrez le titre du fichier.";
const CONSULTATION_IMPOSSIBLE = "Seuls les PDF et les images peuvent être en consultation seule.";
/** Nom donné par l'envoi : un uuid et l'extension, directement dans le dossier de la formation. */
const NOM_FICHIER = /^[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i;

type NouvelleRessource = { leconId: string; titre: string; fichier: string; format: string; tailleOctets: number };

export async function addRessource(entree: NouvelleRessource): Promise<Resultat> {
  const parsed = ressourceSchema.safeParse({
    titre: entree.titre,
    fichier: entree.fichier,
    format: entree.format,
    taille_octets: entree.tailleOctets,
    telechargeable: true,
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? ECHEC };
  if (!estUuid(entree.leconId)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: lecon } = await supabase.from("lecons").select("modules(formation_id)").eq("id", entree.leconId).maybeSingle();
    const parent = (lecon as { modules?: { formation_id?: string } | { formation_id?: string }[] } | null)?.modules;
    const formationId = Array.isArray(parent) ? parent[0]?.formation_id : parent?.formation_id;
    if (!formationId) return { ok: false, message: ECHEC };
    const [dossier, nom, ...reste] = parsed.data.fichier.split("/");
    if (dossier !== formationId || !nom || reste.length > 0 || !NOM_FICHIER.test(nom)) return { ok: false, message: HORS_DOSSIER };
    const ordre = await rangSuivant(supabase, "ressources", ["lecon_id", entree.leconId]);
    const { error } = await supabase.from("ressources").insert({ lecon_id: entree.leconId, ...parsed.data, ordre });
    if (error) return { ok: false, message: ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Titre et mode (téléchargeable ou consultation seule) d'une ressource. */
export async function updateRessource(entree: { id: string; titre: string; telechargeable: boolean }): Promise<Resultat> {
  const titre = entree.titre.trim();
  if (!titre) return { ok: false, message: TITRE_FICHIER };
  if (titre.length > 120) return { ok: false, message: "120 caractères au maximum." };
  if (!estUuid(entree.id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: ressource } = await supabase.from("ressources").select("format").eq("id", entree.id).maybeSingle();
    if (!ressource) return { ok: false, message: ECHEC };
    if (!entree.telechargeable && !formatParMime((ressource as { format: string }).format)?.consultable) {
      return { ok: false, message: CONSULTATION_IMPOSSIBLE };
    }
    const { error } = await supabase.from("ressources").update({ titre, telechargeable: entree.telechargeable }).eq("id", entree.id);
    if (error) return { ok: false, message: ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Supprime une ressource, puis son fichier. */
export async function deleteRessource(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: ressource } = await supabase.from("ressources").select("fichier").eq("id", id).maybeSingle();
    const { error } = await supabase.from("ressources").delete().eq("id", id);
    if (error) return { ok: false, message: ECHEC };
    await retirerFichiers(supabase, ressource ? [ressource] : []);
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

// ─── Image de couverture d'une formation (spec des couvertures, 13 octobre 2026) ───────────────────
// Comme les ressources, le navigateur dépose le fichier dans l'espace « couvertures » (règle de la 0012 : l'équipe,
// dans le dossier de la formation) ; ces actions l'enregistrent sur la formation et suppriment l'ancien fichier.

async function couvertureActuelle(supabase: Supabase, formationId: string): Promise<string | null> {
  const { data } = await supabase.from("formations").select("couverture").eq("id", formationId).maybeSingle();
  const chemin = (data as { couverture?: string | null } | null)?.couverture;
  return typeof chemin === "string" && chemin ? chemin : null;
}

/** Supprime un ancien fichier ; un échec ne remet pas en cause l'enregistrement (fichier orphelin sans effet). */
async function supprimerFichier(supabase: Supabase, chemin: string | null) {
  if (!chemin) return;
  try {
    await supabase.storage.from("couvertures").remove([chemin]);
  } catch {
    // Rien : la formation pointe déjà vers sa nouvelle image.
  }
}

/** Enregistre l'image déposée comme couverture de la formation, puis supprime l'ancienne. */
export async function enregistrerCouverture(formationId: string, chemin: string): Promise<Resultat> {
  if (!estUuid(formationId)) return { ok: false, message: ECHEC };
  if (!cheminValide(formationId, chemin)) return { ok: false, message: HORS_DOSSIER };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const ancienne = await couvertureActuelle(supabase, formationId);
    const { error } = await supabase.from("formations").update({ couverture: chemin }).eq("id", formationId);
    if (error) return { ok: false, message: ECHEC };
    if (ancienne !== chemin) await supprimerFichier(supabase, ancienne);
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Retire la couverture : la formation reprend la couverture par défaut de son parcours. */
export async function retirerCouverture(formationId: string): Promise<Resultat> {
  if (!estUuid(formationId)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const ancienne = await couvertureActuelle(supabase, formationId);
    const { error } = await supabase.from("formations").update({ couverture: null }).eq("id", formationId);
    if (error) return { ok: false, message: ECHEC };
    await supprimerFichier(supabase, ancienne);
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

// ─── Relecture (spec de l'espace formateur, §2) ─────────────────────────────

/** Le formateur envoie son brouillon en relecture ; la base vérifie que c'est le sien et qu'il a une leçon. */
export async function envoyerEnRelecture(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEditeur();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.rpc("envoyer_en_relecture", { p_formation: id });
    if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** L'équipe renvoie une formation en attente à son formateur, avec une remarque (obligatoire, 1 000 caractères au plus). */
export async function renvoyerAuFormateur(id: string, remarque: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerDomaine("contenus");
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.rpc("renvoyer_au_formateur", { p_formation: id, p_remarque: (remarque ?? "").trim().slice(0, 1000) });
    if (error) {
      if (error.code === "42501") return { ok: false, message: ACCES_EQUIPE };
      return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
    }
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}
