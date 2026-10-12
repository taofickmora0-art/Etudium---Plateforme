"use server";

import { refresh } from "next/cache";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrorsFrom, type FormState } from "@/lib/auth/schemas";
import type { createClient } from "@/lib/supabase/server";
import { exigerEquipe } from "./garde";
import { formateurSchema, formationInfosSchema, lignes, parcoursSchema } from "./schemas";
import { slugify } from "./slug";

// Actions serveur du back-office (spec du lot 1, §10). Chacune revérifie l'équipe (exigerEquipe), puis la base
// revérifie encore (règles d'accès de la 0004).

const ECHEC = authErrorMessage(null);
const ADRESSE_PRISE = "Cette adresse est déjà prise.";
const DEPLACEMENT_ECHOUE = "Le déplacement n’a pas abouti.";
const FORMATION_VIDE = "Ajoutez au moins une leçon avant de publier.";
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
    const garde = await exigerEquipe();
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
  const saisie = { nom: texte(fd, "nom"), titre: texte(fd, "titre"), domaine: texte(fd, "domaine"), presentation: texte(fd, "presentation") };
  const values = enTextes(saisie);
  const parsed = formateurSchema.safeParse(saisie);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    const garde = await exigerEquipe();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    const { error } = id ? await supabase.from("formateurs").update(parsed.data).eq("id", id) : await supabase.from("formateurs").insert(parsed.data);
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
    const garde = await exigerEquipe();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { error } = await garde.supabase.rpc("deplacer", { p_table: table, p_id: id, p_sens: sens });
    if (error) return { ok: false, message: DEPLACEMENT_ECHOUE };
  } catch {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  refresh();
  return { ok: true };
}

// ─── Formations ─────────────────────────────────────────────────────────────

/** Nouvelle formation en brouillon ; son adresse vient du titre, avec « -2 », « -3 »… si elle est déjà prise. */
export async function createFormation(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = { titre: texte(fd, "titre") };
  const parsed = formationInfosSchema.pick({ titre: true }).safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    const garde = await exigerEquipe();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    let base = slugify(parsed.data.titre) || "formation";
    const { data: prises } = await supabase.from("formations").select("slug").like("slug", `${base}%`);
    const utilisees = new Set(((prises as { slug: string }[] | null) ?? []).map((p) => p.slug));
    if (utilisees.has(base)) base = base.slice(0, 76).replace(/-+$/, "");
    let slug = base;
    for (let n = 2; utilisees.has(slug); n++) slug = `${base}-${n}`;
    const { data, error } = await supabase.from("formations").insert({ titre: parsed.data.titre, slug }).select("id").single();
    if (error || !data) return erreurEnregistrement(error ?? {}, values);
    return { status: "success", redirection: `/admin/formations/${(data as { id: string }).id}` };
  } catch {
    return { status: "error", message: ECHEC, values };
  }
}

const nombreOuNull = (saisie: string) => (saisie.trim() === "" ? null : Number(saisie.replace(/\s/g, "").replace(",", ".")));

/** Onglet « Informations » d'une formation, puis ses parcours (ajoutés en fin de liste, retirés s'ils sont décochés). */
export async function saveFormationInfos(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = texte(fd, "id");
  const titre = texte(fd, "titre");
  const parcoursCoches = [...new Set(fd.getAll("parcours").map(String).filter(estUuid))];
  const saisie = {
    titre,
    slug: texte(fd, "slug").trim() || slugify(titre),
    resume: texte(fd, "resume"),
    description: texte(fd, "description"),
    objectifs: lignes(texte(fd, "objectifs")),
    competences: lignes(texte(fd, "competences")),
    niveau: texte(fd, "niveau"),
    formateur_id: texte(fd, "formateur_id") || null,
    gratuite: coche(fd, "gratuite"),
    achat_separe: coche(fd, "achat_separe"),
    prix_fcfa: nombreOuNull(texte(fd, "prix_fcfa")),
    badge: texte(fd, "badge") || null,
    seuil_video: Number(texte(fd, "seuil_video")),
  };
  const values = {
    ...enTextes({ ...saisie, prix_fcfa: texte(fd, "prix_fcfa"), seuil_video: texte(fd, "seuil_video") }),
    objectifs: saisie.objectifs.join("\n"),
    competences: saisie.competences.join("\n"),
    parcours: parcoursCoches.join(","),
  };
  const parsed = formationInfosSchema.safeParse(saisie);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  if (!estUuid(id)) return { status: "error", message: ECHEC, values };

  try {
    const garde = await exigerEquipe();
    if ("erreur" in garde) return { status: "error", message: garde.erreur, values };
    const { supabase } = garde;
    const { error } = await supabase.from("formations").update(parsed.data).eq("id", id);
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
  } catch {
    return { status: "error", message: ECHEC, values };
  }
  refresh();
  return { status: "success", values };
}

/** Publier (au moins une leçon), archiver ou republier une formation. */
export async function setStatutFormation(id: string, statut: "publiee" | "archivee"): Promise<Resultat> {
  if (!estUuid(id) || (statut !== "publiee" && statut !== "archivee")) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEquipe();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    if (statut === "publiee") {
      const { data: modules, error } = await supabase.from("modules").select("id, lecons(id)").eq("formation_id", id);
      if (error) return { ok: false, message: ECHEC };
      const lecons = ((modules as { lecons?: unknown[] }[] | null) ?? []).reduce((total, m) => total + (m.lecons?.length ?? 0), 0);
      if (lecons === 0) return { ok: false, message: FORMATION_VIDE };
    }
    const { error } = await supabase.from("formations").update({ statut }).eq("id", id);
    if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Supprime un brouillon et ses fichiers. Une formation déjà publiée (même archivée) ne s'efface pas (spec §10). */
export async function deleteFormation(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  try {
    const garde = await exigerEquipe();
    if ("erreur" in garde) return { ok: false, message: garde.erreur };
    const { supabase } = garde;
    const { data: formation } = await supabase.from("formations").select("statut, publiee_le").eq("id", id).maybeSingle();
    if (!formation) return { ok: false, message: ECHEC };
    if ((formation as { publiee_le: string | null }).publiee_le) return { ok: false, message: PUBLIEE_ARCHIVER };
    // Les fichiers de la formation vivent dans son dossier « <id>/ » de l'espace ressources.
    const { data: fichiers } = await supabase.storage.from("ressources").list(id, { limit: 1000 });
    const { error } = await supabase.from("formations").delete().eq("id", id);
    if (error) return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : ECHEC };
    // La ligne d'abord, puis les fichiers : en cas d'échec, mieux vaut un fichier orphelin qu'une ressource sans fichier.
    const chemins = ((fichiers as { name: string }[] | null) ?? []).map((f) => `${id}/${f.name}`);
    if (chemins.length > 0) await supabase.storage.from("ressources").remove(chemins);
  } catch {
    return { ok: false, message: ECHEC };
  }
  return { ok: true, redirection: "/admin/formations" };
}
