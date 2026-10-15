import { estFonctionAbsente, liste, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { normaliserIdentifiant } from "./adresse";
import { MIGRATION_CERTIFICATS, versCertificat, versEtatValidation, versLot3Etudiant, versPageCertificats } from "./conversion";
import type { Certificat, EtatValidation, Lot3Etudiant, PageCertificats } from "./types";

// Les lectures des certificats (migration 0033). La base calcule l'état, délivre le certificat et vérifie qui lit :
// le titulaire pour son fichier, tout le monde pour la vérification.

export { MIGRATION_CERTIFICATS };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const echec = (quoi: string, error: { message?: string; code?: string }) => new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);

/** L'état de validation d'une formation pour le compte (délivre le certificat si tout est rempli) ; null : introuvable. */
export async function lireValidation(formationId: string): Promise<Lecture<EtatValidation | null>> {
  if (!UUID.test(formationId)) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("validation_formation", { p_formation: formationId });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("de la validation", error);
  }
  return { migrationAbsente: false, donnees: versEtatValidation(data) };
}

/** La page « Certificats » : obtenus, et en préparation. */
export async function lireMesCertificats(): Promise<Lecture<PageCertificats>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_certificats");
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("des certificats", error);
  }
  return { migrationAbsente: false, donnees: versPageCertificats(data) };
}

/** Le certificat du compte, pour l'image et le PDF ; null s'il n'est pas le sien, introuvable, ou avant la 0033. */
export async function lireMonCertificat(identifiant: string): Promise<Certificat | null> {
  const propre = normaliserIdentifiant(identifiant);
  if (!propre) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mon_certificat", { p_identifiant: propre });
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw echec("du certificat", error);
  }
  const brut = un(data);
  return brut ? versCertificat(brut) : null;
}

/** La vérification publique : le certificat, ou null s'il n'existe pas. */
export async function verifierCertificat(saisie: string): Promise<Lecture<Certificat | null>> {
  const identifiant = normaliserIdentifiant(saisie);
  if (!identifiant) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verifier_certificat", { p_identifiant: identifiant });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw echec("du certificat", error);
  }
  const brut = un(data);
  return { migrationAbsente: false, donnees: brut ? versCertificat(brut) : null };
}

/** Les certificats délivrés dans les formations du formateur (toutes pour l'équipe) ; null avant la 0033. */
export async function lireCertificatsFormateur(): Promise<number | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("certificats_formateur");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw echec("des certificats", error);
  }
  return Number(data) || 0;
}

/** Scores, exercices et certificat d'un étudiant, dans les formations du formateur ; vide avant la 0033. */
export async function lireLot3Etudiant(etudiantId: string): Promise<Lot3Etudiant[]> {
  if (!UUID.test(etudiantId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lot3_etudiant", { p_etudiant: etudiantId });
  if (error) {
    if (estFonctionAbsente(error)) return [];
    throw echec("du suivi", error);
  }
  return liste(data).map(versLot3Etudiant);
}
