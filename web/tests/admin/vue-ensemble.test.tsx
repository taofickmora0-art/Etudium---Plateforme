// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatistiquesPeriode, VueEnsemble as Donnees } from "@/lib/statistiques/types";
import { fauxSupabase } from "./faux-supabase";

// La vue d'ensemble du back-office (design NdAdmin) et la page « Statistiques » (lot 6 A, spec §4 ; migration 0062).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));
const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const { lireVueEnsemble, lireStatistiquesPeriode } = await import("@/lib/statistiques/data");
const { VueEnsemble } = await import("@/components/admin/statistiques/VueEnsemble");
const { PageStatistiques } = await import("@/components/admin/statistiques/PageStatistiques");

const VUE: Donnees = {
  utilisateurs: { total: 3812, ceMois: 214 },
  abonnes: { actifs: 1046, moisPrecedent: 968 },
  revenusMois: 2450000,
  formations: { total: 38, brouillons: 6 },
  certificats: 1290,
  tauxCompletion: 34,
  abonnementsParMois: [
    { mois: "2026-10", nouveaux: 12, renouvellements: 4 },
    { mois: "2026-11", nouveaux: 20, renouvellements: 8 },
  ],
  formules: [
    { code: "basique", nom: "Basique", part: 31 },
    { code: "standard", nom: "Standard", part: 52 },
    { code: "premium", nom: "Premium", part: 17 },
  ],
  aTraiter: {
    aExaminer: 2,
    paiementsEchoues: [{ id: "p1", nom: "Marcelline Zinsou", formule: "Basique", operateur: "moov", moyenManuel: null, date: "2026-11-14T17:03:00Z" }],
    paiementsEnAttente: [],
    finsProches: [{ profilId: "e1", nom: "Fifamè Agossou", formule: "Basique", fin: "2026-11-18T10:00:00Z", jours: 3 }],
  },
  dernieresInscriptions: [{ id: "e1", nom: "Aïcha Kpadé", creeLe: "2026-09-12T10:00:00Z", formule: "Standard" }, { id: "e2", nom: "Sènami Dossou", creeLe: "2026-08-21T10:00:00Z", formule: null }],
  derniersPaiements: [{ id: "p2", nom: "Aïcha Kpadé", formule: "Standard", dureeMois: 3, operateur: "mtn", moyenManuel: null, montant: 15000, statut: "reussi", date: "2026-11-15T08:42:00Z" }],
};

const VIDE: Donnees = {
  ...VUE,
  utilisateurs: { total: 1, ceMois: 0 },
  abonnes: { actifs: 0, moisPrecedent: 0 },
  revenusMois: 0,
  formations: { total: 0, brouillons: 0 },
  certificats: 0,
  tauxCompletion: null,
  abonnementsParMois: [{ mois: "2026-11", nouveaux: 0, renouvellements: 0 }],
  formules: [{ code: "standard", nom: "Standard", part: 0 }],
  aTraiter: { aExaminer: 0, paiementsEchoues: [], paiementsEnAttente: [], finsProches: [] },
  dernieresInscriptions: [],
  derniersPaiements: [],
};

const PERIODE: StatistiquesPeriode = {
  etudiants: { inscrits: 3, courbe: [{ debut: "2026-11-02", nombre: 1 }, { debut: "2026-11-09", nombre: 2 }], actifs: 2, leconsTerminees: 5, formationsTerminees: 1, quiz: { passes: 4, reussis: 3 }, exercicesValides: 2, secondesVideo: 5400 },
  formations: [
    { id: "f1", titre: "Excel", statut: "publiee", suiveurs: 12, nouveaux: 3, progression: 40, achevement: 25, secondesVideo: 3600, note: 4.5, avis: 8, certificats: 2 },
    { id: "f2", titre: "Word", statut: "desactivee", suiveurs: 30, nouveaux: 0, progression: 70, achevement: 50, secondesVideo: 0, note: null, avis: 0, certificats: 0 },
  ],
  business: { abonnesActifs: 3, nouveaux: 1, renouvellements: 1, revenus: 24000, courbe: [{ debut: "2026-11-02", montant: 24000 }], conversion: 67, formules: [{ code: "standard", nom: "Standard", nombre: 2 }], codesPromo: { utilisations: 1, remise: 1000 } },
};

beforeEach(() => {
  faux.vider();
  replace.mockReset();
});

describe("La vue d'ensemble", () => {
  it("la lecture convertit la réponse de la base ; null si la migration manque", async () => {
    faux.repondre("rpc.vue_ensemble_back_office", {
      data: {
        utilisateurs: { total: 1, ce_mois: 0 }, abonnes: { actifs: 0, mois_precedent: 0 }, revenus_mois: 0, formations: { total: 0, brouillons: 0 }, certificats: 0, taux_completion: null,
        abonnements_par_mois: [], formules: [], a_traiter: { a_examiner: 0, paiements_echoues: [], paiements_en_attente: [], fins_proches: [] }, dernieres_inscriptions: [], derniers_paiements: [],
      },
    });
    expect(await lireVueEnsemble()).toMatchObject({ utilisateurs: { total: 1, ceMois: 0 }, tauxCompletion: null });
    faux.repondre("rpc.vue_ensemble_back_office", { error: { code: "PGRST202" } });
    expect(await lireVueEnsemble()).toBeNull();
    faux.repondre("rpc.statistiques_periode", { error: { code: "PGRST202" } });
    expect(await lireStatistiquesPeriode(30)).toBeNull();
    // Point reporté : une autre erreur (panne, refus) n'est pas une migration absente : elle remonte à la page d'erreur.
    faux.repondre("rpc.vue_ensemble_back_office", { error: { code: "500", message: "panne" } });
    await expect(lireVueEnsemble()).rejects.toThrow();
    faux.repondre("rpc.statistiques_periode", { error: { code: "42501", message: "Réservé aux administrateurs." } });
    await expect(lireStatistiquesPeriode(30)).rejects.toThrow();
  });

  it("les six indicateurs du design, les abonnements par mois, les formules", () => {
    render(<VueEnsemble donnees={VUE} />);
    const tuile = (nom: string) => screen.getByText(nom).closest("[data-tuile]") as HTMLElement;
    expect(within(tuile("Utilisateurs")).getByText("3 812")).toBeInTheDocument();
    expect(within(tuile("Utilisateurs")).getByText("+214 ce mois")).toBeInTheDocument();
    expect(within(tuile("Abonnés actifs")).getByText("+8 %")).toBeInTheDocument();
    expect(within(tuile("Revenus du mois")).getByText("2 450 000 FCFA")).toBeInTheDocument();
    expect(within(tuile("Formations")).getByText("6 en brouillon")).toBeInTheDocument();
    expect(within(tuile("Certificats")).getByText("Depuis le lancement")).toBeInTheDocument();
    expect(within(tuile("Taux de complétion")).getByText("34 %")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Abonnements actifs par mois/ })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Part de la formule Standard" })).toHaveAttribute("aria-valuenow", "52");
  });

  it("à traiter, dernières inscriptions et derniers paiements, avec « Tout voir »", () => {
    render(<VueEnsemble donnees={VUE} />);
    expect(screen.getByRole("link", { name: /2 contenus à examiner/ })).toHaveAttribute("href", "/admin/moderation");
    expect(screen.getByRole("link", { name: /Paiement échoué.*Marcelline Zinsou · Basique · Moov Money/ })).toHaveAttribute("href", "/admin/paiements");
    expect(screen.getByRole("link", { name: /Abonnement bientôt expiré.*Fifamè Agossou · Basique · expire dans 3 jours/ })).toHaveAttribute("href", "/admin/utilisateurs/e1");
    expect(screen.getByText("Sènami Dossou").closest("li")).toHaveTextContent("Gratuit");
    const paiement = screen.getByRole("row", { name: /Aïcha Kpadé/ });
    expect(paiement).toHaveTextContent("Standard · 3 mois");
    expect(paiement).toHaveTextContent("MTN Mobile Money");
    expect(paiement).toHaveTextContent("15 000 FCFA");
    expect(paiement).toHaveTextContent("Réussi");
    expect(screen.getAllByRole("link", { name: "Tout voir" }).map((l) => l.getAttribute("href"))).toEqual(["/admin/utilisateurs", "/admin/paiements"]);
  });

  it("Review Focus 4 : une plateforme vide : des zéros, « — », et des messages à la place des listes", () => {
    render(<VueEnsemble donnees={VIDE} />);
    expect(within(screen.getByText("Taux de complétion").closest("[data-tuile]") as HTMLElement).getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Rien à traiter pour le moment.")).toBeInTheDocument();
    expect(screen.getByText("Aucune inscription pour le moment.")).toBeInTheDocument();
    expect(screen.getByText("Aucun paiement pour le moment.")).toBeInTheDocument();
  });
});

describe("Points reportés : onglets, tri et graphiques", () => {
  it("les onglets mènent à leur panneau et se parcourent aux flèches", async () => {
    const user = userEvent.setup();
    render(<PageStatistiques donnees={PERIODE} periode="30" onglet="etudiants" />);
    const onglet = screen.getByRole("tab", { name: "Étudiants" });
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", onglet.getAttribute("aria-controls"));
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", onglet.id);
    expect(screen.getByRole("tab", { name: "Formations" })).toHaveAttribute("tabindex", "-1");
    onglet.focus();
    await user.keyboard("{ArrowRight}");
    expect(replace).toHaveBeenLastCalledWith("/admin/statistiques?periode=30&onglet=formations", { scroll: false });
    await user.keyboard("{ArrowLeft}");
    expect(replace).toHaveBeenLastCalledWith("/admin/statistiques?periode=30&onglet=business", { scroll: false });
  });

  it("le tri s'inverse au second clic", async () => {
    const user = userEvent.setup();
    render(<PageStatistiques donnees={PERIODE} periode="30" onglet="formations" />);
    const titres = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelector("th, td")?.textContent);
    const bouton = screen.getByRole("button", { name: /Étudiants/ });
    await user.click(bouton);
    expect(titres()).toEqual(["Word", "Excel"]);
    expect(bouton.closest("th")).toHaveAttribute("aria-sort", "descending");
    await user.click(bouton);
    expect(titres()).toEqual(["Excel", "Word"]);
    expect(bouton.closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("un graphique de plus de 7 colonnes n'affiche qu'un libellé sur deux sur téléphone", async () => {
    const { Barres } = await import("@/components/admin/statistiques/Graphiques");
    const colonnes = Array.from({ length: 13 }, (_, i) => ({ cle: String(i), court: `M${i}`, long: `Mois ${i}`, valeurs: [i] }));
    render(<Barres titre="Inscriptions" series={[{ nom: "Inscrits", couleur: "bg-bleu" }]} colonnes={colonnes} />);
    expect(screen.getByText("M1").className).toContain("max-sm:invisible");
    expect(screen.getByText("M2").className).not.toContain("max-sm:invisible");
  });
});

describe("La page « Statistiques »", () => {
  it("la période et l'onglet dans l'adresse ; les chiffres des étudiants", async () => {
    const user = userEvent.setup();
    render(<PageStatistiques donnees={PERIODE} periode="30" onglet="etudiants" />);
    expect(screen.getByText("Nouveaux inscrits").closest("[data-tuile]")).toHaveTextContent("3");
    expect(screen.getByText("Temps de vidéo regardé").closest("[data-tuile]")).toHaveTextContent("1 h 30");
    expect(screen.getByText("Temps mesuré sur les vidéos suivies (YouTube, Vimeo, TikTok, Tella).")).toBeInTheDocument();
    await user.click(within(screen.getByRole("group", { name: "Période" })).getByRole("button", { name: "12 mois" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/statistiques?periode=365&onglet=etudiants", { scroll: false });
    await user.click(screen.getByRole("tab", { name: "Business" }));
    expect(replace).toHaveBeenLastCalledWith("/admin/statistiques?periode=30&onglet=business", { scroll: false });
  });

  it("formations : un tableau trié par colonne ; business : revenus et conversion", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<PageStatistiques donnees={PERIODE} periode="30" onglet="formations" />);
    const titres = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelector("th, td")?.textContent);
    expect(titres()).toEqual(["Excel", "Word"]);
    await user.click(screen.getByRole("button", { name: /Étudiants/ }));
    expect(titres()).toEqual(["Word", "Excel"]);
    expect(screen.getByRole("row", { name: /Word/ })).toHaveTextContent("Désactivée");
    unmount();
    render(<PageStatistiques donnees={PERIODE} periode="30" onglet="business" />);
    expect(screen.getByText("Revenus").closest("[data-tuile]")).toHaveTextContent("24 000 FCFA");
    expect(screen.getByText("Conversion").closest("[data-tuile]")).toHaveTextContent("67 %");
  });
});
