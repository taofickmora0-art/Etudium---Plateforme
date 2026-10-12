"use server";

import { refresh } from "next/cache";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrorsFrom, type FormState } from "@/lib/auth/schemas";
import type { createClient } from "@/lib/supabase/server";
import { exigerEquipe } from "./garde";
import { formateurSchema, parcoursSchema } from "./schemas";
import { slugify } from "./slug";

// Actions serveur du back-office (spec du lot 1, §10). Chacune revérifie l'équipe (exigerEquipe), puis la base
// revérifie encore (règles d'accès de la 0004).

const ECHEC = authErrorMessage(null);
const ADRESSE_PRISE = "Cette adresse est déjà prise.";
const DEPLACEMENT_ECHOUE = "Le déplacement n’a pas abouti.";

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
