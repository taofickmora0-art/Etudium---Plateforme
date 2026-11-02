import type { MoyenManuel, Operateur, StatutPaiement } from "@/lib/abonnement/types";
import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { ElementPaiement, JoursPeriode, StatistiquesPeriode, VueEnsemble } from "./types";

// Lire la vue d'ensemble et les statistiques (migration 0062, domaine « statistiques » : la base le vérifie).

type Brut = Record<string, unknown>;
const nb = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const nbOuNull = (v: unknown) => (v === null || v === undefined ? null : nb(v));
const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const liste = (v: unknown) => (Array.isArray(v) ? (v as Brut[]) : []);
const objet = (v: unknown) => (v && typeof v === "object" ? (v as Brut) : {});

const versPaiement = (p: Brut): ElementPaiement => ({
  id: txt(p.id),
  nom: txt(p.nom),
  formule: txt(p.formule),
  operateur: (p.operateur as Operateur | null) ?? null,
  moyenManuel: (p.moyen_manuel as MoyenManuel | null) ?? null,
  date: txt(p.date),
});

/** null : démo ou migration 0062 absente (la page le dit) ; une autre erreur remonte à la page d'erreur (« Réessayer »). */
async function rpc(nom: string, args?: Record<string, unknown>): Promise<Brut | null> {
  if (demoModeActive()) return null;
  const { data, error } = await (await createClient()).rpc(nom, args);
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture des statistiques impossible (${error.code ?? "?"}).`);
  }
  return data ? (data as Brut) : null;
}

export async function lireVueEnsemble(): Promise<VueEnsemble | null> {
  const d = await rpc("vue_ensemble_back_office");
  if (!d) return null;
  const u = objet(d.utilisateurs);
  const a = objet(d.abonnes);
  const f = objet(d.formations);
  const t = objet(d.a_traiter);
  return {
    utilisateurs: { total: nb(u.total), ceMois: nb(u.ce_mois) },
    abonnes: { actifs: nb(a.actifs), moisPrecedent: nb(a.mois_precedent) },
    revenusMois: nb(d.revenus_mois),
    formations: { total: nb(f.total), brouillons: nb(f.brouillons) },
    certificats: nb(d.certificats),
    tauxCompletion: nbOuNull(d.taux_completion),
    abonnementsParMois: liste(d.abonnements_par_mois).map((m) => ({ mois: txt(m.mois), nouveaux: nb(m.nouveaux), renouvellements: nb(m.renouvellements) })),
    formules: liste(d.formules).map((x) => ({ code: txt(x.code), nom: txt(x.nom), part: nb(x.part) })),
    aTraiter: {
      aExaminer: nb(t.a_examiner),
      paiementsEchoues: liste(t.paiements_echoues).map(versPaiement),
      paiementsEnAttente: liste(t.paiements_en_attente).map(versPaiement),
      finsProches: liste(t.fins_proches).map((x) => ({ profilId: txt(x.profil_id), nom: txt(x.nom), formule: txt(x.formule), fin: txt(x.fin), jours: nb(x.jours) })),
    },
    dernieresInscriptions: liste(d.dernieres_inscriptions).map((x) => ({ id: txt(x.id), nom: txt(x.nom), creeLe: txt(x.cree_le), formule: x.formule ? txt(x.formule) : null })),
    derniersPaiements: liste(d.derniers_paiements).map((x) => ({
      ...versPaiement(x),
      dureeMois: nb(x.duree_mois),
      montant: nb(x.montant),
      statut: txt(x.statut) as StatutPaiement,
    })),
  };
}

export async function lireStatistiquesPeriode(jours: JoursPeriode): Promise<StatistiquesPeriode | null> {
  const d = await rpc("statistiques_periode", { p_jours: jours });
  if (!d) return null;
  const e = objet(d.etudiants);
  const q = objet(e.quiz);
  const b = objet(d.business);
  const c = objet(b.codes_promo);
  return {
    etudiants: {
      inscrits: nb(e.inscrits),
      courbe: liste(e.courbe).map((x) => ({ debut: txt(x.debut), nombre: nb(x.nombre) })),
      actifs: nb(e.actifs),
      leconsTerminees: nb(e.lecons_terminees),
      formationsTerminees: nb(e.formations_terminees),
      quiz: { passes: nb(q.passes), reussis: nb(q.reussis) },
      exercicesValides: nb(e.exercices_valides),
      secondesVideo: nb(e.secondes_video),
    },
    formations: liste(d.formations).map((x) => ({
      id: txt(x.id),
      titre: txt(x.titre),
      statut: x.statut === "desactivee" ? "desactivee" : "publiee",
      suiveurs: nb(x.suiveurs),
      nouveaux: nb(x.nouveaux),
      progression: nb(x.progression),
      achevement: nb(x.achevement),
      secondesVideo: nb(x.secondes_video),
      note: nbOuNull(x.note),
      avis: nb(x.avis),
      certificats: nb(x.certificats),
    })),
    business: {
      abonnesActifs: nb(b.abonnes_actifs),
      nouveaux: nb(b.nouveaux),
      renouvellements: nb(b.renouvellements),
      revenus: nb(b.revenus),
      courbe: liste(b.courbe).map((x) => ({ debut: txt(x.debut), montant: nb(x.montant) })),
      conversion: nbOuNull(b.conversion),
      formules: liste(b.formules).map((x) => ({ code: txt(x.code), nom: txt(x.nom), nombre: nb(x.nombre) })),
      codesPromo: { utilisations: nb(c.utilisations), remise: nb(c.remise) },
    },
  };
}
