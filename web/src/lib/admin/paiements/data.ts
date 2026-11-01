import { versCartePaiement, versEtatAbonnement, versMoyenManuel } from "@/lib/abonnement/conversion";
import { estFonctionAbsente, liste } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { AbonnementsCompte, CodePromo, ComptePaiement, DetailPaiement, EtatReglage, PagePaiements, ResumePaiements } from "./types";

export type { AbonnementCompte, AbonnementsCompte, CodePromo, ComptePaiement, DetailPaiement, EtatReglage, LignePaiement, PagePaiements, ResumePaiements } from "./types";

// Les lectures du back-office « Abonnements et paiements » (0051). La clé Payiz et le jeton du serveur ne sortent
// jamais d'ici : l'écran ne reçoit que leur état.

type Ligne = Record<string, unknown>;


const texte = (v: unknown) => (typeof v === "string" ? v : "");
const texteOuNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);
const nombre = (v: unknown) => Number(v ?? 0) || 0;
const objet = (v: unknown): Ligne => (v && typeof v === "object" ? (v as Ligne) : {});

const versCompte = (v: unknown): ComptePaiement => {
  const c = objet(v);
  return { id: texteOuNull(c.id), prenom: texte(c.prenom), nom: texte(c.nom), email: texte(c.email) };
};

export function versCodePromo(l: Ligne): CodePromo {
  return {
    id: texte(l.id),
    code: texte(l.code),
    type: l.type === "montant" ? "montant" : "pourcentage",
    valeur: nombre(l.valeur),
    debut: texteOuNull(l.debut),
    fin: texteOuNull(l.fin),
    limite: l.limite === null || l.limite === undefined ? null : nombre(l.limite),
    actif: l.actif !== false,
    utilisations: nombre(l.utilisations),
    creeLe: texte(l.cree_le),
  };
}

export function versPagePaiements(v: unknown): PagePaiements {
  const o = objet(v);
  return {
    total: nombre(o.total),
    lignes: liste(o.lignes).map((l) => {
      // La carte de 0049 et les lignes de 0051 partagent leurs champs : on réutilise sa lecture.
      const carte = versCartePaiement({ ...l, prix_initial: l.montant });
      return {
        id: carte.id,
        creeLe: texte(l.cree_le),
        compte: versCompte(l.compte),
        formule: carte.formule,
        montant: carte.montant,
        statut: carte.statut,
        operateur: carte.operateur,
        telephoneMasque: carte.telephoneMasque,
        numeroRecu: carte.numeroRecu,
        source: carte.source,
        moyenManuel: carte.moyenManuel,
      };
    }),
  };
}

export function versDetailPaiement(v: unknown): DetailPaiement {
  const o = objet(v);
  const a = o.abonnement ? objet(o.abonnement) : null;
  return {
    ...versCartePaiement(o),
    compte: o.compte ? versCompte(o.compte) : null,
    abonnementEquipe: a
      ? { id: texte(a.id), debut: texte(a.debut), fin: texte(a.fin), annuleLe: texteOuNull(a.annule_le), motifAnnulation: texteOuNull(a.motif_annulation) }
      : null,
  };
}

/** Les chiffres du mois ; null sans la migration 0051. */
export async function lireResumePaiements(): Promise<ResumePaiements | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resume_paiements");
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(error.message || "Lecture des paiements impossible.");
  }
  const d = objet(data);
  return { revenusMois: nombre(d.revenus_mois), reussisMois: nombre(d.reussis_mois), echouesMois: nombre(d.echoues_mois), abonnesActifs: nombre(d.abonnes_actifs) };
}

export async function lireCodesPromo(): Promise<CodePromo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("codes_promo_equipe");
  return error ? [] : liste(data).map(versCodePromo);
}

export async function lirePaiementsEquipe(f: { statut: string | null; recherche: string; page: number }): Promise<PagePaiements> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("paiements_equipe", { p_statut: f.statut, p_recherche: f.recherche, p_page: f.page });
  return error ? { total: 0, lignes: [] } : versPagePaiements(data);
}

/** L'état du réglage, sans jamais renvoyer la clé ni le jeton. */
export async function lireEtatPaiements(): Promise<EtatReglage> {
  const cle = process.env.PAYIZ_CLE_SECRETE?.trim();
  const jeton = process.env.PAIEMENT_JETON?.trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("etat_paiements", { p_jeton: jeton ?? "" });
  const d = error ? {} : objet(data);
  return {
    ouverts: d.ouverts === true,
    jeton: !jeton ? "absent" : d.jeton_reconnu === true ? "reconnu" : "non_reconnu",
    cle: !cle ? "absente" : cle.startsWith("sk_live_") ? "reel" : "test",
    webhook: Boolean(process.env.PAYIZ_SECRET_WEBHOOK?.trim()),
  };
}

export function versAbonnementsCompte(v: unknown): AbonnementsCompte {
  const o = objet(v);
  return {
    etat: versEtatAbonnement(o.etat),
    abonnements: liste(o.abonnements).map((a) => {
      const carte = versCartePaiement({ formule: a.formule, montant: a.montant, operateur: a.operateur, numero_recu: a.numero_recu });
      return {
        id: texte(a.id),
        formule: carte.formule,
        debut: texte(a.debut),
        fin: texte(a.fin),
        annuleLe: texteOuNull(a.annule_le),
        motifAnnulation: texteOuNull(a.motif_annulation),
        source: a.source === "manuel" ? "manuel" : "payiz",
        moyenManuel: versMoyenManuel(a.moyen_manuel),
        operateur: carte.operateur,
        montant: carte.montant,
        numeroRecu: carte.numeroRecu,
      };
    }),
  };
}

/** La section « Abonnement » de la fiche d'un compte ; null sans la migration 0054. */
export async function lireAbonnementsCompte(compteId: string): Promise<AbonnementsCompte | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("abonnements_compte", { p_compte: compteId });
  return error ? null : versAbonnementsCompte(data);
}
