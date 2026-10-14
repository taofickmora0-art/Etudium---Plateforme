import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures et action du suivi des étudiants (migration 0015).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { lireSuivi, lireSuiviEtudiant, lireTableauDeBordFormateur } = await import("@/lib/formateur/suivi");
const { chercherSuivi, enregistrerRemarque } = await import("@/lib/formateur/actions");

const E = "11111111-1111-4111-8111-111111111111";
const X = "22222222-2222-4222-8222-222222222222";
const LIGNE = {
  etudiant_id: E,
  prenom: "Fifamè",
  nom: "Adjovi",
  formation_id: X,
  formation_titre: "Excel",
  terminees: 6,
  total: 12,
  derniere_activite: "2026-10-13T08:00:00+00:00",
  etat: "en_cours",
};

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
});

describe("Lectures du suivi", () => {
  it("une page du suivi, convertie", async () => {
    faux.repondre("rpc.etudiants_formateur", { data: { total: 31, lignes: [LIGNE] } });
    expect(await lireSuivi("fifa", X, "a_risque", 2)).toEqual({
      migrationAbsente: false,
      donnees: {
        total: 31,
        lignes: [{ etudiantId: E, prenom: "Fifamè", nom: "Adjovi", formationId: X, formationTitre: "Excel", terminees: 6, total: 12, derniereActivite: LIGNE.derniere_activite, etat: "en_cours" }],
      },
    });
    expect(faux.de("rpc", "etudiants_formateur")[0].valeurs).toEqual({ p_recherche: "fifa", p_formation: X, p_etat: "a_risque", p_page: 2 });
  });

  it("la fiche d'un étudiant, convertie ; null pour un identifiant mal formé, sans appel", async () => {
    faux.repondre("rpc.etudiant_formateur", {
      data: {
        id: E,
        prenom: "Fifamè",
        nom: "Adjovi",
        formations: [
          {
            id: X,
            titre: "Excel",
            terminees: 1,
            total: 2,
            secondes: 90,
            derniere_activite: "2026-10-13T08:00:00+00:00",
            etat: "en_cours",
            modules: [{ id: "m1", titre: "Module 1", lecons: [{ id: "l1", titre: "Leçon 1", etat: "terminee", terminee_le: "2026-10-12T08:00:00+00:00", secondes: 90 }] }],
          },
        ],
        remarque: { texte: "Progresse bien.", modifiee_le: "2026-10-13T09:00:00+00:00" },
      },
    });
    expect(await lireSuiviEtudiant(E)).toEqual({
      migrationAbsente: false,
      donnees: {
        id: E,
        prenom: "Fifamè",
        nom: "Adjovi",
        formations: [
          {
            id: X,
            titre: "Excel",
            terminees: 1,
            total: 2,
            secondes: 90,
            derniereActivite: "2026-10-13T08:00:00+00:00",
            etat: "en_cours",
            modules: [{ id: "m1", titre: "Module 1", lecons: [{ id: "l1", titre: "Leçon 1", etat: "terminee", termineeLe: "2026-10-12T08:00:00+00:00", secondes: 90 }] }],
          },
        ],
        remarque: { texte: "Progresse bien.", modifieeLe: "2026-10-13T09:00:00+00:00" },
      },
    });
    faux.vider();
    expect(await lireSuiviEtudiant("abc")).toEqual({ migrationAbsente: false, donnees: null });
    expect(faux.appels).toEqual([]);
  });

  it("le tableau de bord, converti", async () => {
    faux.repondre("rpc.tableau_de_bord_formateur", {
      data: {
        prenom: "Mireille",
        formations: { total: 3, brouillons: 1 },
        etudiants: { total: 4, ce_mois: 3 },
        progression_moyenne: 38,
        a_risque: [{ etudiant_id: E, prenom: "Fifamè", nom: "Adjovi", formation_id: X, formation_titre: "Excel", jours: 14, pourcentage: 22 }],
        formations_detail: [
          { id: X, titre: "Excel", statut: "brouillon", envoyee_le: "2026-10-13T08:00:00+00:00", renvoyee_le: null, inscrits: 2, progression_moyenne: 50, completion: 50, note_moyenne: 4.8, nb_avis: 12 },
        ],
      },
    });
    expect(await lireTableauDeBordFormateur()).toEqual({
      migrationAbsente: false,
      donnees: {
        prenom: "Mireille",
        formations: { total: 3, brouillons: 1 },
        etudiants: { total: 4, ceMois: 3 },
        progressionMoyenne: 38,
        aRisque: [{ etudiantId: E, prenom: "Fifamè", nom: "Adjovi", formationId: X, formationTitre: "Excel", jours: 14, pourcentage: 22 }],
        formationsDetail: [
          {
            id: X,
            titre: "Excel",
            etat: "en_attente",
            inscrits: 2,
            progressionMoyenne: 50,
            completion: 50,
            noteMoyenne: 4.8,
            nbAvis: 12,
          },
        ],
      },
    });
  });

  it("avant la migration 0015 : migrationAbsente ; toute autre erreur est relancée", async () => {
    faux.repondre("rpc.tableau_de_bord_formateur", { error: { code: "PGRST202" } });
    expect(await lireTableauDeBordFormateur()).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.etudiants_formateur", { error: { code: "500", message: "panne" } });
    await expect(lireSuivi("", null, "tous", 1)).rejects.toThrow();
  });
});

describe("Actions du suivi", () => {
  it("refusées à un étudiant et à un admin qui n'est pas formateur, sans appel", async () => {
    for (const roles of [["etudiant"], ["etudiant", "admin"]]) {
      getShellUser.mockResolvedValue({ roles });
      expect(await chercherSuivi("", null, "tous", 1)).toEqual({ ok: false, message: "Accès réservé aux formateurs." });
      expect(await enregistrerRemarque(E, "x")).toEqual({ ok: false, message: "Accès réservé aux formateurs." });
    }
    expect(faux.appels).toEqual([]);
  });

  it("chercherSuivi : paramètres nettoyés (page ≥ 1, formation UUID ou rien, filtre connu)", async () => {
    faux.repondre("rpc.etudiants_formateur", { data: { total: 0, lignes: [] } });
    expect(await chercherSuivi("  fifa ", "pas-un-uuid", "nimporte" as never, 0)).toEqual({ ok: true, page: { total: 0, lignes: [] } });
    expect(faux.de("rpc", "etudiants_formateur")[0].valeurs).toEqual({ p_recherche: "fifa", p_formation: null, p_etat: "tous", p_page: 1 });
  });

  it("enregistrerRemarque : la fonction de la base ; son refus est affiché ; la page est relue", async () => {
    expect(await enregistrerRemarque(E, "Progresse bien.")).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_remarque")[0].valeurs).toEqual({ p_etudiant: E, p_texte: "Progresse bien." });
    expect(refresh).toHaveBeenCalled();
    faux.repondre("rpc.enregistrer_remarque", { error: { code: "P0001", message: "Cet étudiant ne suit aucune de vos formations." } });
    expect(await enregistrerRemarque(E, "x")).toEqual({ ok: false, message: "Cet étudiant ne suit aucune de vos formations." });
    expect(await enregistrerRemarque("abc", "x")).toMatchObject({ ok: false });
  });
});
