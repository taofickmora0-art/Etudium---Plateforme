import type { TagTone } from "@/components/ui/Tag";
import { FUSEAU_BENIN } from "@/lib/dates/fuseau";
import { nomPays } from "@/lib/paiements/pays";
import { messageEchec, nomOperateur } from "@/lib/paiements/regles";
import type { CartePaiement, EtapePaiement, EtatAbonnement, MoyenManuel, StatutPaiement } from "./types";

// Les règles des abonnements (lot 2) : durées, montants, dates (à l'heure du Bénin), étapes d'un paiement.

/** « 3 mois », « 6 mois », « 1 an ». */
export const dureeAbonnement = (mois: number): string => (mois === 12 ? "1 an" : `${mois} mois`);

const FCFA = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** « 15 000 FCFA ». */
export const montantFcfa = (n: number): string => `${FCFA.format(n)} FCFA`;

/**
 * Un montant dans la monnaie d'un opérateur, tel que Payiz le donne (en unités mineures : 32150 GHS → « 321,50 GHS ») ;
 * le franc CFA reste « 15 000 FCFA ».
 */
export function montantDevise(n: number, devise: string): string {
  if (devise === "XOF") return montantFcfa(n);
  let decimales = 0;
  try {
    decimales = new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise }).resolvedOptions().maximumFractionDigits ?? 0;
  } catch {
    decimales = 0;
  }
  const format = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return `${format.format(n / 10 ** decimales)} ${devise}`;
}

const DATE_LONGUE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU_BENIN });

/** « 14 mars 2027 », « 1er mai 2027 », à l'heure du Bénin. */
export const dateLongue = (iso: string): string => DATE_LONGUE.format(new Date(iso)).replace(/^1 /, "1er ");

/** Le Bénin est à UTC+1 toute l'année (pas d'heure d'été). */
const DECALAGE_BENIN_MS = 60 * 60 * 1000;

/**
 * Ajoute des mois comme la base (`fin_periode`, 0049) : à l'heure du Bénin, ramené au dernier jour du mois
 * (31 août + 6 mois = 28 février).
 */
export function ajouterMois(iso: string, mois: number): string {
  const local = new Date(new Date(iso).getTime() + DECALAGE_BENIN_MS);
  const annee = local.getUTCFullYear();
  const cible = local.getUTCMonth() + mois;
  const dernierJour = new Date(Date.UTC(annee, cible + 1, 0)).getUTCDate();
  const instant = Date.UTC(
    annee,
    cible,
    Math.min(local.getUTCDate(), dernierJour),
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(instant - DECALAGE_BENIN_MS).toISOString();
}

/** Les dates d'un nouvel abonnement : il commence à la fin de celui en cours, sinon tout de suite. */
export function periodeSouscription(maintenant: Date, etat: EtatAbonnement, mois: number): { debut: string; fin: string } {
  const debut = etat.etat === "actif" ? new Date(etat.fin).toISOString() : maintenant.toISOString();
  return { debut, fin: ajouterMois(debut, mois) };
}

/** Jours avant la fin, arrondis au jour supérieur ; 0 une fois la fin passée. */
export const joursRestants = (fin: string, maintenant: Date): number => Math.max(0, Math.ceil((Date.parse(fin) - maintenant.getTime()) / 86_400_000));

const STATUTS: Record<StatutPaiement, { libelle: string; ton: TagTone }> = {
  reussi: { libelle: "Réussi", ton: "reussi" },
  en_attente: { libelle: "En attente", ton: "enAttente" },
  echoue: { libelle: "Échoué", ton: "echoue" },
  expire: { libelle: "Expiré", ton: "enAttente" },
  annule: { libelle: "Annulé", ton: "enAttente" },
};

export const libelleStatut = (s: StatutPaiement) => STATUTS[s];

const MOYENS_MANUELS: Record<MoyenManuel, string> = {
  mobile_money: "Mobile Money hors plateforme",
  especes: "Espèces",
  virement: "Virement",
  offert: "Offert",
};

/**
 * « Celtiis Cash (Bénin) » : le nom de l'opérateur au moment du paiement et le pays du payeur (0072). Un paiement d'avant
 * n'a que le code (« MTN Mobile Money », « Moov Money ») ; un moyen enregistré à la main (0054), ou « Offert » (code
 * promo à 100 %).
 */
export function libelleMoyen(
  p: Pick<CartePaiement, "montant" | "operateur"> & { operateurNom?: string | null; pays?: string | null; moyenManuel?: MoyenManuel | null },
): string {
  if (p.moyenManuel) return MOYENS_MANUELS[p.moyenManuel];
  if (p.montant === 0) return "Offert";
  const nom = nomOperateur(p.operateur, p.operateurNom);
  return p.pays ? `${nom} (${nomPays(p.pays)})` : nom;
}

/** L'écran d'attente redemande l'état pendant 3 minutes après chaque essai. */
export const DUREE_ATTENTE_MS = 3 * 60 * 1000;

export function etapeDepuisCarte(c: CartePaiement): EtapePaiement {
  switch (c.statut) {
    case "reussi":
      return { etat: "reussi", paiement: c };
    case "echoue":
      return { etat: "echoue", paiement: c, message: messageEchec(c.motifEchec) };
    case "expire":
    case "annule":
      return { etat: "expire", paiement: c };
    default:
      return { etat: "attente", paiement: c, finAttente: new Date(Date.parse(c.essaiLe ?? c.creeLe) + DUREE_ATTENTE_MS).toISOString() };
  }
}

/** La formule affichée sous le nom (« Étudiante · Standard ») : celle de l'abonnement en cours, sinon « Gratuite ». */
export const formuleDuCompte = (e: EtatAbonnement): string => (e.etat === "actif" ? e.formule.nom : "Gratuite");
