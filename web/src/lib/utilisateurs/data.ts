import { estFonctionAbsente, liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { estRole } from "./regles";
import type { CompteDetail, CompteResume, FiltreComptes, Lecture, PageComptes, RemarqueFormateur } from "./types";

// Lecture des comptes par les fonctions de la migration 0013, réservées à l'équipe (spec des utilisateurs, §2, §3, §5).
// Sans la migration : migrationAbsente (la page le dit) ; toute autre erreur est relancée (écran d'erreur).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Erreur = { code?: string; message?: string } | null;

const nombre = (valeur: unknown) => Number(valeur) || 0;
const dateOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const roles = (valeur: unknown) => (Array.isArray(valeur) ? valeur.filter(estRole) : []);

function identite(l: Ligne): Omit<CompteResume, "suspendu"> {
  return {
    id: texte(l.id),
    prenom: texte(l.prenom),
    nom: texte(l.nom),
    email: texte(l.email),
    roles: roles(l.roles),
    inscritLe: texte(l.inscrit_le),
    derniereConnexion: dateOuNull(l.derniere_connexion),
  };
}

/** Une page de comptes, telle que la rend la fonction comptes_equipe. */
export function versPage(data: unknown): PageComptes {
  const brut = un(data);
  return {
    total: nombre(brut?.total),
    comptes: liste(brut?.comptes).map((l) => ({ ...identite(l), suspendu: l.suspendu === true, ...(typeof l.formule === "string" ? { formule: l.formule } : {}) })),
  };
}

function versDetail(l: Ligne): CompteDetail {
  const suspension = un(l.suspension);
  const fiche = un(l.fiche_formateur);
  return {
    ...identite(l),
    suspension: suspension ? { depuis: texte(suspension.depuis), parNom: texte(suspension.par_nom), motif: texte(suspension.motif) } : null,
    ficheFormateur: fiche ? { id: texte(fiche.id), nom: texte(fiche.nom) } : null,
    formations: liste(l.formations).map((f) => ({
      id: texte(f.id),
      titre: texte(f.titre),
      slug: texte(f.slug),
      terminees: nombre(f.terminees),
      total: nombre(f.total),
      derniereActivite: texte(f.derniere_activite),
    })),
    avis: liste(l.avis).map((a) => ({
      id: texte(a.id),
      formationTitre: texte(a.formation_titre),
      note: nombre(a.note),
      commentaire: texte(a.commentaire),
      masque: a.masque === true,
      creeLe: texte(a.cree_le),
    })),
  };
}

function echec(quoi: string, error: NonNullable<Erreur>): never {
  throw new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);
}

/** Une page de 25 comptes (recherche, filtre), les plus récents d'abord. */
export async function lireComptes(recherche: string, filtre: FiltreComptes, page: number): Promise<Lecture<PageComptes>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("comptes_equipe", { p_recherche: recherche, p_filtre: filtre, p_page: page });
  if (error) return estFonctionAbsente(error) ? { migrationAbsente: true } : echec("des comptes", error);
  return { migrationAbsente: false, donnees: versPage(data) };
}

/** La fiche d'un compte ; null s'il n'existe pas (ou si l'identifiant n'en est pas un). */
export async function lireCompte(id: string): Promise<Lecture<CompteDetail | null>> {
  if (!UUID.test(id)) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("compte_equipe", { p_compte: id });
  if (error) return estFonctionAbsente(error) ? { migrationAbsente: true } : echec("du compte", error);
  const ligne = un(data);
  return { migrationAbsente: false, donnees: ligne ? versDetail(ligne) : null };
}

/** Les remarques des formateurs sur un compte (migration 0015), pour la fiche du compte au back-office. */
export async function lireRemarquesFormateurs(compteId: string): Promise<Lecture<RemarqueFormateur[]>> {
  if (!UUID.test(compteId)) return { migrationAbsente: false, donnees: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remarques_compte", { p_compte: compteId });
  if (error) return estFonctionAbsente(error) ? { migrationAbsente: true } : echec("des remarques", error);
  return {
    migrationAbsente: false,
    donnees: liste(data).map((r) => ({ formateurNom: texte(r.formateur_nom), texte: texte(r.texte), modifieeLe: texte(r.modifiee_le) })),
  };
}
