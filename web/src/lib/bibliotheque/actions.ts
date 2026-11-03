"use server";

import { refresh } from "next/cache";
import { exigerDomaine } from "@/lib/admin/garde";
import { slugify } from "@/lib/admin/slug";
import { authErrorMessage } from "@/lib/auth/messages";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import type { createClient } from "@/lib/supabase/server";
import {
  cheminCouvertureValide,
  cheminPdfValide,
  ESPACE_LIVRES,
  estUuid,
  LIVRE_MAX_OCTETS,
  MIGRATION_BIBLIOTHEQUE,
  PDF_TROP_LOURD,
  saisieVersLigne,
} from "./regles";
import type { CategorieRangee, ResultatLivre, SaisieLivre, StatutLivre } from "./types";

// Les actions du back-office de la Bibliothèque (spec du 3 novembre 2026, étape A ; migration 0074). Comme pour les
// formations, l'équipe des contenus écrit directement dans les tables ; chaque action revérifie le domaine, puis la base
// revérifie (règles d'accès, déclencheurs : publier exige le PDF et la case des droits, seul un brouillon se supprime).
// Les fichiers sont déposés par le navigateur avant l'enregistrement (jusqu'à 50 Mo, au-delà de ce que permet une action
// serveur) ; l'action retire ceux que l'enregistrement remplace.

type Supabase = Awaited<ReturnType<typeof createClient>>;
type ErreurBase = { code?: string; message?: string } | null | undefined;
type Resultat = { ok: true; redirection?: string } | { ok: false; message: string };

const ECHEC = authErrorMessage(null);
const HORS_DOSSIER_PDF = "Ce fichier n’est pas dans le dossier du livre.";
const HORS_DOSSIER_IMAGE = "Cette image n’est pas dans le dossier du livre.";
const LIVRE_DISPARU = "Ce livre n’existe plus.";
const PUBLIE_ARCHIVER = "Un livre publié s’archive, il ne se supprime pas.";
const DEPLACEMENT_ECHOUE = "Le déplacement n’a pas abouti.";
/** Essais d'adresse : une autre fiche peut prendre la même entre la lecture et l'écriture. */
const ESSAIS_ADRESSE = 10;

const tableAbsente = (e: ErreurBase) => e?.code === "42P01" || e?.code === "PGRST205";
const migrationAbsente = (e: ErreurBase) => tableAbsente(e) || estFonctionAbsente(e ?? null);
/** Les messages des règles de la base sont écrits avec l'apostrophe droite ; l'interface utilise l'apostrophe typographique. */
const typographie = (message: string) => message.replace(/'/g, "’");
/** Le message d'une erreur de la base : sa règle (en français), la migration absente, ou le message générique. */
function messageBase(e: ErreurBase): string {
  if (migrationAbsente(e)) return MIGRATION_BIBLIOTHEQUE;
  if (e?.code === "P0001" && e.message) return typographie(e.message);
  return ECHEC;
}
const plie = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr-FR").replace(/\s+/g, " ").trim();

async function garde() {
  try {
    return await exigerDomaine("contenus");
  } catch {
    return { erreur: ECHEC };
  }
}

/** Retire des fichiers d'un espace ; un échec ne remet pas en cause l'enregistrement (fichier orphelin sans effet). */
async function retirer(supabase: Supabase, espace: string, chemins: string[]) {
  if (chemins.length === 0) return;
  try {
    await supabase.storage.from(espace).remove(chemins);
  } catch {
    // Rien : le livre pointe déjà vers ses nouveaux fichiers.
  }
}

// ─── Les livres ─────────────────────────────────────────────────────────────────────────────────────

/** Les adresses candidates d'un titre : la base, puis « base-2 », « base-3 »… raccourcies sous 90 caractères. */
function candidate(base: string, n: number) {
  if (n === 1) return base;
  const suffixe = `-${n}`;
  return base.slice(0, 90 - suffixe.length).replace(/-+$/, "") + suffixe;
}

/** Le premier rang libre pour ce titre (l'adresse du livre lui-même ne compte pas). */
async function premierRangLibre(supabase: Supabase, base: string, livreId: string): Promise<{ n: number } | { erreur: ErreurBase }> {
  const { data, error } = await supabase
    .from("livres")
    .select("id, slug")
    .like("slug", `${base.slice(0, 80)}%`);
  if (error) return { erreur: error };
  const prises = new Set(((data as { id: string; slug: string }[] | null) ?? []).filter((l) => l.id !== livreId).map((l) => l.slug));
  let n = 1;
  while (prises.has(candidate(base, n))) n++;
  return { n };
}

/**
 * Enregistre la fiche d'un livre (nouveau ou modifié), puis ses parcours. Tant qu'il n'a jamais été publié, son adresse
 * suit son titre ; publié, elle est figée (la base le garantit). Un PDF ou une couverture remplacés sont supprimés.
 */
export async function enregistrerLivre(saisie: SaisieLivre): Promise<ResultatLivre> {
  if (!saisie || !estUuid(saisie.id)) return { ok: false, message: ECHEC };
  const verifiee = saisieVersLigne(saisie);
  if (!verifiee.ok) return { ok: false, erreurs: verifiee.erreurs };
  if (saisie.fichier) {
    if (!cheminPdfValide(saisie.id, saisie.fichier.chemin)) return { ok: false, erreurs: { fichier: HORS_DOSSIER_PDF } };
    if (!Number.isInteger(saisie.fichier.tailleOctets) || saisie.fichier.tailleOctets < 1 || saisie.fichier.tailleOctets > LIVRE_MAX_OCTETS) {
      return { ok: false, erreurs: { fichier: PDF_TROP_LOURD } };
    }
  }
  if (typeof saisie.couverture === "string" && !cheminCouvertureValide(saisie.id, saisie.couverture)) return { ok: false, message: HORS_DOSSIER_IMAGE };
  const parcours = [...new Set((saisie.parcours ?? []).filter(estUuid))];

  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const { supabase } = g;
  let remplaces: { pdf: string | null; couverture: string | null } = { pdf: null, couverture: null };
  try {
    // Le livre tel qu'il est. Un nouveau livre peut déjà exister : un premier essai interrompu après l'écriture de sa
    // fiche (ses parcours ont échoué, la connexion a coupé) ; il est alors modifié, sous le même identifiant.
    const lu = await supabase.from("livres").select("fichier, couverture, publie_le").eq("id", saisie.id).maybeSingle();
    if (lu.error) return { ok: false, message: messageBase(lu.error) };
    const actuel = (lu.data as { fichier: string | null; couverture: string | null; publie_le: string | null } | null) ?? null;
    if (!actuel && !saisie.nouveau) return { ok: false, message: LIVRE_DISPARU };
    const ligne = {
      ...verifiee.ligne,
      ...(saisie.fichier ? { fichier: saisie.fichier.chemin, taille_octets: saisie.fichier.tailleOctets } : {}),
      ...(saisie.couverture !== undefined ? { couverture: saisie.couverture } : {}),
    };

    let erreur: ErreurBase = null;
    if (actuel?.publie_le) {
      ({ error: erreur } = await supabase.from("livres").update(ligne).eq("id", saisie.id));
    } else {
      // Jamais publié : l'adresse vient du titre, avec « -2 », « -3 »… si elle est prise.
      const base = slugify(verifiee.ligne.titre) || "livre";
      const rang = await premierRangLibre(supabase, base, saisie.id);
      if ("erreur" in rang) return { ok: false, message: messageBase(rang.erreur) };
      for (let essai = 0, n = rang.n; essai < ESSAIS_ADRESSE; essai++, n++) {
        const valeurs = { ...ligne, slug: candidate(base, n) };
        ({ error: erreur } = actuel
          ? await supabase.from("livres").update(valeurs).eq("id", saisie.id)
          : await supabase.from("livres").insert({ id: saisie.id, ...valeurs }));
        if (!(erreur?.code === "23505" && /slug/.test(erreur.message ?? ""))) break;
      }
    }
    if (erreur) {
      if (erreur.code === "P0001" && /droit/i.test(erreur.message ?? "")) return { ok: false, erreurs: { droitsConfirmes: typographie(erreur.message ?? "") } };
      if (erreur.code === "P0001" && /PDF/.test(erreur.message ?? "")) return { ok: false, erreurs: { fichier: typographie(erreur.message ?? "") } };
      return { ok: false, message: messageBase(erreur) };
    }

    // Les parcours : ceux qui sont décochés retirés, les nouveaux ajoutés.
    let existants: string[] = [];
    if (actuel) {
      const { data, error } = await supabase.from("livres_parcours").select("parcours_id").eq("livre_id", saisie.id);
      if (error) return { ok: false, message: messageBase(error) };
      existants = ((data as { parcours_id: string }[] | null) ?? []).map((l) => l.parcours_id);
    }
    const retires = existants.filter((p) => !parcours.includes(p));
    if (retires.length > 0) {
      const { error } = await supabase.from("livres_parcours").delete().eq("livre_id", saisie.id).in("parcours_id", retires);
      if (error) return { ok: false, message: messageBase(error) };
    }
    const ajoutes = parcours.filter((p) => !existants.includes(p));
    if (ajoutes.length > 0) {
      const { error } = await supabase.from("livres_parcours").insert(ajoutes.map((p) => ({ livre_id: saisie.id, parcours_id: p })));
      if (error) return { ok: false, message: messageBase(error) };
    }

    remplaces = {
      pdf: actuel?.fichier && saisie.fichier && actuel.fichier !== saisie.fichier.chemin ? actuel.fichier : null,
      couverture: actuel?.couverture && saisie.couverture !== undefined && actuel.couverture !== saisie.couverture ? actuel.couverture : null,
    };
  } catch {
    return { ok: false, message: ECHEC };
  }
  if (remplaces.pdf) await retirer(supabase, ESPACE_LIVRES, [remplaces.pdf]);
  if (remplaces.couverture) await retirer(supabase, "couvertures", [remplaces.couverture]);
  refresh();
  return { ok: true, id: saisie.id };
}

/** Publier (ou republier) et archiver ; la base garde les passages permis et la règle de publication. */
export async function changerStatutLivre(id: string, statut: Exclude<StatutLivre, "brouillon">): Promise<Resultat> {
  if (!estUuid(id) || (statut !== "publie" && statut !== "archive")) return { ok: false, message: ECHEC };
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  try {
    const { data, error } = await g.supabase.from("livres").update({ statut }).eq("id", id).select("id");
    if (error) return { ok: false, message: messageBase(error) };
    if (Array.isArray(data) && data.length === 0) return { ok: false, message: LIVRE_DISPARU };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Supprime un brouillon jamais publié, puis ses fichiers (son dossier dans « bibliotheque » et dans « couvertures »). */
export async function supprimerLivre(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const { supabase } = g;
  try {
    const { data: livre, error } = await supabase.from("livres").select("statut, publie_le").eq("id", id).maybeSingle();
    if (error) return { ok: false, message: messageBase(error) };
    if (!livre) return { ok: false, message: LIVRE_DISPARU };
    const l = livre as { statut: string; publie_le: string | null };
    if (l.statut !== "brouillon" || l.publie_le) return { ok: false, message: PUBLIE_ARCHIVER };
    // La ligne d'abord : si la base la refuse, les fichiers restent. Les règles des espaces ne dépendent pas d'elle.
    const { error: refus } = await supabase.from("livres").delete().eq("id", id);
    if (refus) return { ok: false, message: messageBase(refus) };
    for (const [espace, dossier] of [
      [ESPACE_LIVRES, id],
      ["couvertures", `livres/${id}`],
    ] as const) {
      const { data: fichiers } = await supabase.storage.from(espace).list(dossier, { limit: 1000 });
      await retirer(
        supabase,
        espace,
        ((fichiers as { name: string }[] | null) ?? []).map((f) => `${dossier}/${f.name}`),
      );
    }
  } catch {
    return { ok: false, message: ECHEC };
  }
  return { ok: true, redirection: "/admin/bibliotheque" };
}

// ─── Les catégories ─────────────────────────────────────────────────────────────────────────────────

/** Crée une catégorie (en fin de liste) ou la renomme ; son adresse, tirée du nom à la création, ne change plus. */
export async function enregistrerCategorie(entree: {
  id?: string | null;
  nom: string;
}): Promise<{ ok: true; categorie: CategorieRangee } | { ok: false; message: string }> {
  const nom = String(entree?.nom ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!nom) return { ok: false, message: "Entrez le nom de la catégorie." };
  if (nom.length > 60) return { ok: false, message: "60 caractères au maximum." };
  const id = entree.id ?? null;
  if (id !== null && !estUuid(id)) return { ok: false, message: ECHEC };
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const { supabase } = g;
  try {
    const { data, error } = await supabase.from("categories_livres").select("id, nom, slug, ordre");
    if (error) return { ok: false, message: messageBase(error) };
    const toutes = (data as CategorieRangee[] | null) ?? [];
    if (toutes.some((c) => c.id !== id && plie(c.nom) === plie(nom))) return { ok: false, message: "Cette catégorie existe déjà." };
    const COLONNES = "id, nom, slug, ordre";
    if (id) {
      const { data: modifiee, error: e } = await supabase.from("categories_livres").update({ nom }).eq("id", id).select(COLONNES).single();
      if (e || !modifiee) return { ok: false, message: e ? messageBase(e) : ECHEC };
      refresh();
      return { ok: true, categorie: modifiee as CategorieRangee };
    }
    const base = slugify(nom) || "categorie";
    const prises = new Set(toutes.map((c) => c.slug));
    let n = 1;
    while (prises.has(candidate(base, n))) n++;
    const ordre = toutes.reduce((max, c) => Math.max(max, Number(c.ordre) || 0), 0) + 1;
    const { data: creee, error: e } = await supabase
      .from("categories_livres")
      .insert({ nom, slug: candidate(base, n), ordre })
      .select(COLONNES)
      .single();
    if (e?.code === "23505") return { ok: false, message: "Cette catégorie existe déjà." };
    if (e || !creee) return { ok: false, message: e ? messageBase(e) : ECHEC };
    refresh();
    return { ok: true, categorie: creee as CategorieRangee };
  } catch {
    return { ok: false, message: ECHEC };
  }
}

/** Supprime une catégorie : ses livres restent, sans catégorie. */
export async function supprimerCategorie(id: string): Promise<Resultat> {
  if (!estUuid(id)) return { ok: false, message: ECHEC };
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  try {
    const { error } = await g.supabase.from("categories_livres").delete().eq("id", id);
    if (error) return { ok: false, message: messageBase(error) };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Range une catégorie à un rang (1 = en tête). */
export async function rangerCategorie(id: string, position: number): Promise<Resultat> {
  if (!estUuid(id) || !Number.isInteger(position) || position < 1) return { ok: false, message: DEPLACEMENT_ECHOUE };
  return rpcRangement("ranger_categorie_livre", { p_categorie: id, p_position: position });
}

async function rpcRangement(fonction: string, args: Record<string, unknown>): Promise<Resultat> {
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  try {
    const { error } = await g.supabase.rpc(fonction, args);
    if (error) return { ok: false, message: migrationAbsente(error) || error.code === "P0001" ? messageBase(error) : DEPLACEMENT_ECHOUE };
  } catch {
    return { ok: false, message: DEPLACEMENT_ECHOUE };
  }
  refresh();
  return { ok: true };
}

// ─── Les livres recommandés d'une formation (« Pour aller plus loin ») ─────────────────────────────

/** Ajoute un livre publié en fin de liste ; la base refuse un brouillon ou un livre archivé. */
export async function ajouterLivreFormation(formationId: string, livreId: string): Promise<Resultat> {
  if (!estUuid(formationId) || !estUuid(livreId)) return { ok: false, message: ECHEC };
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  const { supabase } = g;
  try {
    const { data: dernier, error: e } = await supabase
      .from("livres_formations")
      .select("ordre")
      .eq("formation_id", formationId)
      .order("ordre", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (e) return { ok: false, message: messageBase(e) };
    const ordre = Number((dernier as { ordre?: number } | null)?.ordre ?? 0) + 1;
    const { error } = await supabase.from("livres_formations").insert({ formation_id: formationId, livre_id: livreId, ordre });
    if (error?.code === "42501") return { ok: false, message: "Seul un livre publié peut être recommandé." };
    if (error?.code === "23505") return { ok: false, message: "Ce livre est déjà recommandé." };
    if (error) return { ok: false, message: messageBase(error) };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

export async function retirerLivreFormation(formationId: string, livreId: string): Promise<Resultat> {
  if (!estUuid(formationId) || !estUuid(livreId)) return { ok: false, message: ECHEC };
  const g = await garde();
  if ("erreur" in g) return { ok: false, message: g.erreur };
  try {
    const { error } = await g.supabase.from("livres_formations").delete().eq("formation_id", formationId).eq("livre_id", livreId);
    if (error) return { ok: false, message: messageBase(error) };
  } catch {
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}

/** Range un livre recommandé à un rang de la formation (1 = en tête). */
export async function rangerLivreFormation(formationId: string, livreId: string, position: number): Promise<Resultat> {
  if (!estUuid(formationId) || !estUuid(livreId) || !Number.isInteger(position) || position < 1) return { ok: false, message: DEPLACEMENT_ECHOUE };
  return rpcRangement("ranger_livre_formation", { p_formation: formationId, p_livre: livreId, p_position: position });
}
