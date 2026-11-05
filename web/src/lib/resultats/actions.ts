"use server";

import { refresh } from "next/cache";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, texte, un } from "@/lib/contenus/lecture";
import { INDISPONIBLE } from "@/lib/indisponible";
import { clientResultats, garderJeton } from "./acces";
import { versEtat, versReglesBase } from "./conversion";
import { refusBareme, refusCredits, refusNote, refusPoids, refusRegles } from "./regles";
import type { Categorie, Regles } from "./types";

// Les actions de « Mes résultats » (migration 0077) : le code PIN (créer, ouvrir, reverrouiller, changer, retirer,
// oublier) et la saisie (parcours, semestres, UE, ECUE, notes : enregistrer, supprimer, déplacer). La saisie est
// vérifiée ici (regles.ts), puis la base revérifie tout ; avant d'écrire, l'ouverture se prolonge (etat_resultats).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN = /^[0-9]{4}$/;
const CODE_INVALIDE = "Le code doit faire 4 chiffres.";
const ECHEC = "L’enregistrement n’a pas abouti. Réessaie.";
const VERROUILLE = "Ton espace s’est reverrouillé : saisis ton code.";
const SESSION_EXPIREE = "Ta session a expiré. Reconnecte-toi.";

export type Retour = { ok: true; id?: string } | { ok: false; message: string; verrouille?: boolean; reconnecter?: boolean };
type Erreur = { code?: string; message?: string };
type Client = Awaited<ReturnType<typeof clientResultats>>;

function refus(error: Erreur): Retour & { ok: false } {
  if (estFonctionAbsente(error)) return { ok: false, message: INDISPONIBLE };
  if (error.code === "42501") return { ok: false, message: VERROUILLE, verrouille: true };
  if (error.code === "P0001" && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
  return { ok: false, message: ECHEC };
}

// ─── Le code PIN ─────────────────────────────────────────────────────────────────────────────────────

/** Une fonction du code : { ok, jeton? } (le jeton ouvre l'espace) ou { ok: false, message }. */
async function appelCode(nom: string, args?: Record<string, string | null>): Promise<Retour> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const { data, error } = await (await clientResultats()).rpc(nom, args);
  if (error) return refus(error);
  const r = un(data);
  if (r?.ok !== true) return { ok: false, message: texte(r?.message) || ECHEC };
  if (texte(r.jeton)) await garderJeton(texte(r.jeton));
  refresh();
  return { ok: true };
}

/** Créer son code (première fois, ou après l'avoir retiré ou oublié). */
export async function creerPin(pin: string): Promise<Retour> {
  if (!PIN.test(pin)) return { ok: false, message: CODE_INVALIDE };
  return appelCode("definir_pin_resultats", { p_pin: pin });
}

/** Changer son code, avec le code actuel. */
export async function changerPin(actuel: string, nouveau: string): Promise<Retour> {
  if (!PIN.test(actuel) || !PIN.test(nouveau)) return { ok: false, message: CODE_INVALIDE };
  return appelCode("definir_pin_resultats", { p_pin: nouveau, p_actuel: actuel });
}

/** Ouvrir l'espace avec son code. */
export async function ouvrirResultats(pin: string): Promise<Retour> {
  if (!PIN.test(pin)) return { ok: false, message: CODE_INVALIDE };
  return appelCode("ouvrir_resultats", { p_pin: pin });
}

/** Reverrouiller (bouton, ou 15 minutes sans activité) : le jeton ne vaut plus rien. */
export async function verrouillerResultats(): Promise<void> {
  try {
    await (await clientResultats()).rpc("fermer_resultats");
  } finally {
    await garderJeton(null);
    refresh();
  }
}

/** Des gestes sans enregistrement (lire, déplier, composer) : la base repousse la fin du jeton, sans relire la page. */
export async function prolongerResultats(): Promise<{ ouvert: boolean }> {
  const { data, error } = await (await clientResultats()).rpc("etat_resultats");
  return { ouvert: !error && versEtat(data).ouvert };
}

/** « Plus tard » : la proposition du code ne revient plus. */
export async function passerProposition(): Promise<Retour> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const { error } = await (await clientResultats()).rpc("proposer_pin_vu");
  if (error) return refus(error);
  refresh();
  return { ok: true };
}

/** Retirer son code, avec le code. */
export async function retirerPin(pin: string): Promise<Retour> {
  if (!PIN.test(pin)) return { ok: false, message: CODE_INVALIDE };
  const r = await appelCode("retirer_pin_resultats", { p_pin: pin });
  if (r.ok) await garderJeton(null);
  return r;
}

/** Code oublié : possible juste après une connexion (sinon, il faut se reconnecter). Les résultats sont gardés. */
export async function oublierPin(): Promise<Retour> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const { error } = await (await clientResultats()).rpc("oublier_pin_resultats");
  if (error) {
    if (error.code === "42501") return { ok: false, message: (error.message || "Reconnecte-toi pour créer un nouveau code.").replace(/'/g, "’"), reconnecter: true };
    return refus(error);
  }
  await garderJeton(null);
  refresh();
  return { ok: true };
}

// ─── La saisie ───────────────────────────────────────────────────────────────────────────────────────

/** Un client prêt à écrire : la session est là et l'espace ouvert (l'ouverture est prolongée). */
async function pourEcrire(): Promise<{ supabase: Client } | (Retour & { ok: false })> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const supabase = await clientResultats();
  const { data, error } = await supabase.rpc("etat_resultats");
  if (error) return refus(error);
  if (!versEtat(data).ouvert) return { ok: false, message: VERROUILLE, verrouille: true };
  return { supabase };
}

type Table = "parcours_scolaires" | "semestres_scolaires" | "ue_scolaires" | "ecue_scolaires" | "notes_scolaires";

/** Crée (sans id) ou modifie une ligne, puis relit la page. */
async function enregistrer(table: Table, id: string | undefined, creation: Record<string, unknown>, modification: Record<string, unknown>): Promise<Retour> {
  if (id !== undefined && !UUID.test(id)) return { ok: false, message: ECHEC };
  const acces = await pourEcrire();
  if (!("supabase" in acces)) return acces;
  const requete = id === undefined ? acces.supabase.from(table).insert(creation).select("id").single() : acces.supabase.from(table).update(modification).eq("id", id).select("id").maybeSingle();
  const { data, error } = await requete;
  if (error) return refus(error);
  const nouvel = texte(un(data)?.id);
  if (!nouvel) return { ok: false, message: ECHEC };
  refresh();
  return { ok: true, id: nouvel };
}

const longueur = (v: string, min: number, max: number) => v.length >= min && v.length <= max;

export type SaisieParcours = { id?: string; nom: string; etablissement: string; regles: Regles };
export async function enregistrerParcours(s: SaisieParcours): Promise<Retour> {
  const nom = s.nom.trim();
  const etablissement = s.etablissement.trim();
  if (!longueur(nom, 1, 120)) return { ok: false, message: "Donne un nom au parcours (120 caractères au plus)." };
  if (etablissement.length > 120) return { ok: false, message: "Le nom de l’établissement fait 120 caractères au plus." };
  const regles = refusRegles(s.regles);
  if (regles) return { ok: false, message: regles };
  const valeurs = { nom, etablissement, regles: versReglesBase(s.regles) };
  return enregistrer("parcours_scolaires", s.id, valeurs, valeurs);
}

export type SaisieSemestre = { id?: string; parcoursId: string; nom: string; annee: string };
export async function enregistrerSemestre(s: SaisieSemestre): Promise<Retour> {
  const nom = s.nom.trim();
  const annee = s.annee.trim();
  if (!UUID.test(s.parcoursId)) return { ok: false, message: ECHEC };
  if (!longueur(nom, 1, 60)) return { ok: false, message: "Donne un nom au semestre (60 caractères au plus)." };
  if (annee.length > 20) return { ok: false, message: "L’année universitaire fait 20 caractères au plus." };
  return enregistrer("semestres_scolaires", s.id, { parcours_id: s.parcoursId, nom, annee }, { nom, annee });
}

export type SaisieUe = { id?: string; semestreId: string; code: string; intitule: string; credits: number };
export async function enregistrerUe(s: SaisieUe): Promise<Retour> {
  const code = s.code.trim();
  const intitule = s.intitule.trim();
  if (!UUID.test(s.semestreId)) return { ok: false, message: ECHEC };
  if (!longueur(intitule, 1, 120)) return { ok: false, message: "Donne un intitulé à l’UE (120 caractères au plus)." };
  if (code.length > 20) return { ok: false, message: "Le code de l’UE fait 20 caractères au plus." };
  const credits = refusCredits(s.credits);
  if (credits) return { ok: false, message: credits };
  return enregistrer("ue_scolaires", s.id, { semestre_id: s.semestreId, code, intitule, credits: s.credits }, { code, intitule, credits: s.credits });
}

export type SaisieEcue = { id?: string; ueId: string; intitule: string; poids: number; bareme: Categorie[] | null };
export async function enregistrerEcue(s: SaisieEcue): Promise<Retour> {
  const intitule = s.intitule.trim();
  if (!UUID.test(s.ueId)) return { ok: false, message: ECHEC };
  if (!longueur(intitule, 1, 120)) return { ok: false, message: "Donne un intitulé à l’ECUE (120 caractères au plus)." };
  const poids = refusPoids(s.poids);
  if (poids) return { ok: false, message: poids };
  const bareme = s.bareme ? refusBareme(s.bareme) : null;
  if (bareme) return { ok: false, message: bareme };
  const valeurs = { intitule, poids: s.poids, bareme: s.bareme ? versReglesBase({ seuilUe: 10, seuilSemestre: 10, compensation: false, rattrapage: "remplace", categories: s.bareme }).categories : null };
  return enregistrer("ecue_scolaires", s.id, { ue_id: s.ueId, ...valeurs }, valeurs);
}

export type SaisieNote = { id?: string; ecueId: string; categorie: string; libelle: string; note: number; sur: number; rattrapage: boolean; date: string | null };
export async function enregistrerNote(s: SaisieNote): Promise<Retour> {
  const libelle = s.libelle.trim();
  if (!UUID.test(s.ecueId) || !/^[a-z0-9-]{1,30}$/.test(s.categorie)) return { ok: false, message: ECHEC };
  if (libelle.length > 60) return { ok: false, message: "Le libellé fait 60 caractères au plus." };
  const note = refusNote(s.note, s.sur);
  if (note) return { ok: false, message: note };
  if (s.date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return { ok: false, message: "Choisis une date valable." };
  const valeurs = { categorie: s.categorie, libelle, note: s.note, sur: s.sur, rattrapage: s.rattrapage === true, date: s.date };
  return enregistrer("notes_scolaires", s.id, { ecue_id: s.ecueId, ...valeurs }, valeurs);
}

// ─── Supprimer et déplacer ───────────────────────────────────────────────────────────────────────────

export type TypeElement = "parcours" | "semestre" | "ue" | "ecue" | "note";
const TABLES: Record<TypeElement, Table> = {
  parcours: "parcours_scolaires",
  semestre: "semestres_scolaires",
  ue: "ue_scolaires",
  ecue: "ecue_scolaires",
  note: "notes_scolaires",
};
/** La colonne du parent, pour ranger parmi ses frères (les parcours : tous ceux du compte). */
const PARENTS: Partial<Record<TypeElement, string>> = { semestre: "parcours_id", ue: "semestre_id", ecue: "ue_id" };

/** Supprimer un élément (et tout ce qu'il contient). */
export async function supprimerElement(type: TypeElement, id: string): Promise<Retour> {
  if (!(type in TABLES) || !UUID.test(id)) return { ok: false, message: ECHEC };
  const acces = await pourEcrire();
  if (!("supabase" in acces)) return acces;
  const { error } = await acces.supabase.from(TABLES[type]).delete().eq("id", id);
  if (error) return refus(error);
  refresh();
  return { ok: true };
}

/** Monter (-1) ou descendre (1) un élément parmi ses frères ; les ordres sont renumérotés sans trou. */
export async function deplacerElement(type: Exclude<TypeElement, "note">, id: string, sens: -1 | 1): Promise<Retour> {
  if (!(type in TABLES) || type === ("note" as TypeElement) || !UUID.test(id) || (sens !== -1 && sens !== 1)) return { ok: false, message: ECHEC };
  const acces = await pourEcrire();
  if (!("supabase" in acces)) return acces;
  const table = TABLES[type];
  const parent = PARENTS[type];
  const { data: element, error: e1 } = await acces.supabase.from(table).select(parent ? `id, ${parent}` : "id").eq("id", id).maybeSingle();
  if (e1) return refus(e1);
  if (!element) return { ok: false, message: ECHEC };
  let freres = acces.supabase.from(table).select("id, ordre");
  if (parent) freres = freres.eq(parent, (element as unknown as Record<string, unknown>)[parent]);
  const { data, error: e2 } = await freres.order("ordre");
  if (e2) return refus(e2);
  const ids = (Array.isArray(data) ? data : []).map((l) => texte((l as Record<string, unknown>).id));
  const i = ids.indexOf(id);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [ordre, cible] of ids.entries()) {
    const { error } = await acces.supabase.from(table).update({ ordre }).eq("id", cible);
    if (error) return refus(error);
  }
  refresh();
  return { ok: true };
}
