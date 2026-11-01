import { cache } from "react";
import { demoModeActive } from "@/lib/auth/current-user";
import { liste } from "@/lib/contenus/lecture";
import { configurationPaiement } from "@/lib/paiements/config";
import { createClient } from "@/lib/supabase/server";
import { versCartePaiement, versEtatAbonnement, versFormule, versMoyenManuel } from "./conversion";
import type { CartePaiement, EtatAbonnement, Formule, MoyenManuel, Operateur } from "./types";

// Les lectures des abonnements (0049). Sans la migration, l'appli se comporte comme avant le lot 2 : compte gratuit,
// prix « annoncés au lancement », aucun paiement.

type Ligne = Record<string, unknown>;

/** Le reçu imprimable d'un paiement réussi (`recu()`, 0049). */
export type Recu = {
  numero: string;
  date: string;
  compte: { prenom: string; nom: string };
  formule: { nom: string; dureeMois: number };
  debut: string | null;
  fin: string | null;
  prixInitial: number;
  remise: number;
  code: string | null;
  montant: number;
  operateur: Operateur | null;
  telephoneMasque: string | null;
  /** Attribué à la main au back-office (0054). */
  moyenManuel: MoyenManuel | null;
  referenceManuelle: string | null;
};

/** Les trois formules, dans leur ordre ; [] sans la migration. */
export const lireFormules = cache(async (): Promise<Formule[]> => {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("formules").select("id, code, nom, duree_mois, prix_fcfa, recommandee, active").order("ordre");
  if (error) return [];
  return liste(data).map(versFormule);
});

/** L'état du compte connecté, à la date du jour. */
export const lireAbonnement = cache(async (): Promise<EtatAbonnement> => {
  if (demoModeActive()) return { etat: "gratuit" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mon_abonnement");
  return error ? { etat: "gratuit" } : versEtatAbonnement(data);
});

/** L'historique des paiements du compte, du plus récent au plus ancien. */
export async function lirePaiements(): Promise<CartePaiement[]> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_paiements");
  return error ? [] : liste(data).map(versCartePaiement);
}

const nombre = (v: unknown) => Number(v ?? 0) || 0;
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const texteOuNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

/** Un reçu : à son compte et à l'équipe (la base le vérifie) ; null sinon. */
export async function lireRecu(numero: string): Promise<Recu | null> {
  if (demoModeActive() || !numero) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recu", { p_numero: numero });
  if (error || !data || typeof data !== "object") return null;
  const r = data as Ligne;
  const compte = (r.compte ?? {}) as Ligne;
  const formule = (r.formule ?? {}) as Ligne;
  return {
    numero: texte(r.numero),
    date: texte(r.date),
    compte: { prenom: texte(compte.prenom), nom: texte(compte.nom) },
    formule: { nom: texte(formule.nom), dureeMois: nombre(formule.duree_mois) },
    debut: texteOuNull(r.debut),
    fin: texteOuNull(r.fin),
    prixInitial: nombre(r.prix_initial),
    remise: nombre(r.remise),
    code: texteOuNull(r.code),
    montant: nombre(r.montant),
    operateur: r.operateur === "mtn" || r.operateur === "moov" ? r.operateur : null,
    telephoneMasque: texteOuNull(r.telephone_masque),
    moyenManuel: versMoyenManuel(r.moyen_manuel),
    referenceManuelle: texteOuNull(r.reference_manuelle),
  };
}

/** « Payer » est possible : l'équipe a activé les paiements, et le serveur a sa clé Payiz et un jeton reconnu. */
export async function paiementsOuverts(): Promise<boolean> {
  const config = configurationPaiement();
  if (demoModeActive() || !config) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("paiements_prets", { p_jeton: config.jeton });
  return !error && data === true;
}
