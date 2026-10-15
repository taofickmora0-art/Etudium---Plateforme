import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lot 3, étape B : la logique des exercices dans l'appli (lectures, dépôt, correction, téléchargement, formats).
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { lireExercice, lireMesExercices, lireStatutsExercices, lireCorrections, lireRenduACorriger, MIGRATION_EXERCICES } = await import("@/lib/exercices/data");
const { rendreExercice, terminerExercice, corrigerRendu, lienRendu } = await import("@/lib/exercices/actions");
const { FORMATS_RENDU, RENDU_MAX_OCTETS, formatDeRendu } = await import("@/lib/exercices/fichiers");

const L = "11111111-1111-4111-8111-111111111111";
const R = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";
const ABSENTE = { error: { code: "PGRST202", message: "Could not find the function" } };
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const VERSION = {
  id: R,
  version: 1,
  nom_fichier: "Tableau_ventes.xlsx",
  format: XLSX,
  taille_octets: 142000,
  message: "J’ai ajouté le filtre.",
  statut: "a_corriger",
  remarque: "Il manque le filtre par produit.",
  correcteur: "Mireille Adjovi",
  corrige_le: "2026-10-15T09:00:00Z",
  cree_le: "2026-10-15T08:00:00Z",
  a_un_fichier: true,
};
const VERSION_APP = {
  id: R,
  version: 1,
  nomFichier: "Tableau_ventes.xlsx",
  format: XLSX,
  tailleOctets: 142000,
  message: "J’ai ajouté le filtre.",
  statut: "a_corriger",
  remarque: "Il manque le filtre par produit.",
  correcteur: "Mireille Adjovi",
  corrigeLe: "2026-10-15T09:00:00Z",
  creeLe: "2026-10-15T08:00:00Z",
  aUnFichier: true,
};

beforeEach(() => {
  faux.vider();
  getShellUser.mockReset().mockResolvedValue({ roles: ["etudiant"] });
});

describe("Les lectures des exercices", () => {
  it("l'exercice de l'étudiant, converti ; null sans accès ou avant la 0032", async () => {
    faux.repondre("rpc.exercice_etudiant", { data: { genre: "rendu", statut: "a_corriger", peut_deposer: true, versions: [VERSION] } });
    expect(await lireExercice(L)).toEqual({ genre: "rendu", statut: "a_corriger", peutDeposer: true, versions: [VERSION_APP] });
    expect(faux.de("rpc", "exercice_etudiant")[0].valeurs).toEqual({ p_lecon: L });
    faux.vider();
    faux.repondre("rpc.exercice_etudiant", { data: null });
    expect(await lireExercice(L)).toBeNull();
    faux.vider();
    faux.repondre("rpc.exercice_etudiant", ABSENTE);
    expect(await lireExercice(L)).toBeNull();
  });

  it("la page Exercices, les statuts d'une formation ; avant la 0032, la migration est signalée", async () => {
    faux.repondre("rpc.mes_exercices", {
      data: [
        {
          lecon_id: L,
          titre: "Tableau des ventes",
          genre: "rendu",
          formation: "Excel",
          slug: "excel",
          module: "Analyse",
          module_rang: 3,
          statut: "a_corriger",
          version: 1,
          remarque: "Il manque le filtre.",
          correcteur: "Mireille Adjovi",
          corrige_le: "2026-10-15T09:00:00Z",
          cree_le: "2026-10-15T08:00:00Z",
        },
      ],
    });
    expect(await lireMesExercices()).toEqual({
      migrationAbsente: false,
      donnees: [
        {
          leconId: L,
          titre: "Tableau des ventes",
          genre: "rendu",
          formation: "Excel",
          slug: "excel",
          module: "Analyse",
          moduleRang: 3,
          statut: "a_corriger",
          version: 1,
          remarque: "Il manque le filtre.",
          correcteur: "Mireille Adjovi",
          corrigeLe: "2026-10-15T09:00:00Z",
          creeLe: "2026-10-15T08:00:00Z",
        },
      ],
    });
    faux.repondre("rpc.mes_statuts_exercices", { data: { [L]: "valide" } });
    expect(await lireStatutsExercices(F)).toEqual({ [L]: "valide" });
    faux.vider();
    faux.repondre("rpc.mes_exercices", ABSENTE);
    faux.repondre("rpc.mes_statuts_exercices", ABSENTE);
    expect(await lireMesExercices()).toEqual({ migrationAbsente: true });
    expect(await lireStatutsExercices(F)).toEqual({});
    expect(MIGRATION_EXERCICES).toBe("Appliquez la migration 0032 (guide « Ce qui te revient », section 38).");
  });

  it("les corrections à faire et le détail d'un travail ; null sans droit", async () => {
    faux.repondre("rpc.corrections_a_faire", {
      data: [{ rendu_id: R, etudiant: "Aïcha Kpadé", exercice: "Tableau des ventes", formation: "Excel", formation_id: F, module: "Analyse", module_rang: 3, version: 2, nom_fichier: "v2.xlsx", depose_le: "2026-10-15T08:00:00Z" }],
    });
    expect(await lireCorrections()).toEqual({
      migrationAbsente: false,
      donnees: [{ renduId: R, etudiant: "Aïcha Kpadé", exercice: "Tableau des ventes", formation: "Excel", formationId: F, module: "Analyse", moduleRang: 3, version: 2, nomFichier: "v2.xlsx", deposeLe: "2026-10-15T08:00:00Z" }],
    });
    faux.repondre("rpc.rendu_a_corriger", {
      data: {
        etudiant: "Aïcha Kpadé",
        exercice: { id: L, titre: "Tableau des ventes", genre: "rendu", consigne: "Créez un **TCD**." },
        formation: { id: F, titre: "Excel", slug: "excel" },
        module: { titre: "Analyse", rang: 3 },
        version: VERSION,
        derniere: true,
        historique: [VERSION],
        suivant: null,
      },
    });
    expect(await lireRenduACorriger(R)).toEqual({
      etudiant: "Aïcha Kpadé",
      exercice: { id: L, titre: "Tableau des ventes", genre: "rendu", consigne: "Créez un **TCD**." },
      formation: { id: F, titre: "Excel", slug: "excel" },
      module: { titre: "Analyse", rang: 3 },
      version: VERSION_APP,
      derniere: true,
      historique: [VERSION_APP],
      suivant: null,
    });
    faux.vider();
    faux.repondre("rpc.rendu_a_corriger", { data: null });
    expect(await lireRenduACorriger(R)).toBeNull();
    expect(await lireRenduACorriger("pas-un-id")).toBeNull();
    faux.repondre("rpc.corrections_a_faire", ABSENTE);
    expect(await lireCorrections()).toEqual({ migrationAbsente: true });
  });
});

describe("Déposer, terminer, corriger, télécharger", () => {
  it("le dépôt part à la base ; ses refus reviennent tels quels ; sans compte ou identifiant mal formé, rien ne part", async () => {
    faux.repondre("rpc.rendre_exercice", { data: { id: R, version: 2, statut: "en_attente" } });
    expect(await rendreExercice(L, `u/${L}/a.xlsx`, "Tableau.xlsx", "Bonjour")).toEqual({ ok: true, version: 2 });
    expect(faux.de("rpc", "rendre_exercice")[0].valeurs).toEqual({ p_lecon: L, p_fichier: `u/${L}/a.xlsx`, p_nom: "Tableau.xlsx", p_message: "Bonjour" });
    faux.vider();
    faux.repondre("rpc.rendre_exercice", { error: { code: "P0001", message: "Votre travail attend déjà sa correction." } });
    expect(await rendreExercice(L, "x", "x", "")).toEqual({ ok: false, message: "Votre travail attend déjà sa correction." });
    faux.vider();
    faux.repondre("rpc.rendre_exercice", ABSENTE);
    expect(await rendreExercice(L, "x", "x", "")).toEqual({ ok: false, message: MIGRATION_EXERCICES });
    faux.vider();
    expect(await rendreExercice("pas-un-id", "x", "x", "")).toEqual({ ok: false, message: "Votre travail n’a pas pu être envoyé. Réessayez." });
    getShellUser.mockResolvedValue(null);
    expect(await rendreExercice(L, "x", "x", "")).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
    expect(faux.appels).toEqual([]);
  });

  it("« Marquer comme terminé » ; la correction (décision connue seulement) ; les refus de la base", async () => {
    expect(await terminerExercice(L)).toEqual({ ok: true });
    expect(faux.de("rpc", "terminer_exercice")[0].valeurs).toEqual({ p_lecon: L });
    expect(await corrigerRendu(R, "a_corriger", "Il manque le filtre.")).toEqual({ ok: true });
    expect(faux.de("rpc", "corriger_rendu")[0].valeurs).toEqual({ p_rendu: R, p_decision: "a_corriger", p_remarque: "Il manque le filtre." });
    faux.vider();
    expect(await corrigerRendu(R, "supprimer" as never, "")).toEqual({ ok: false, message: "La correction n’a pas pu être enregistrée. Réessayez." });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.corriger_rendu", { error: { code: "P0001", message: "Ce travail a déjà été corrigé." } });
    expect(await corrigerRendu(R, "valide", "")).toEqual({ ok: false, message: "Ce travail a déjà été corrigé." });
  });

  it("le lien de téléchargement : 60 s, avec le nom du fichier ; sans droit, refusé", async () => {
    faux.repondre("rpc.fichier_rendu", { data: { chemin: `u/${L}/a.xlsx`, nom: "Tableau des ventes.xlsx" } });
    faux.repondre("storage.rendus.createSignedUrl", { data: { signedUrl: "https://stockage/rendus/a?token=t" } });
    expect(await lienRendu(R)).toEqual({ url: `https://stockage/rendus/a?token=t&download=${encodeURIComponent("Tableau des ventes.xlsx")}` });
    expect(faux.de("storage.rendus", "createSignedUrl")[0].valeurs).toEqual([`u/${L}/a.xlsx`, 60]);
    faux.vider();
    faux.repondre("rpc.fichier_rendu", { data: null });
    expect(await lienRendu(R)).toEqual({ erreur: "Ce fichier n’est pas accessible." });
  });
});

describe("Les formats de rendu", () => {
  it("PDF, Word, Excel, PowerPoint, image ou ZIP, 20 Mo ; la même liste que l'espace « rendus » de la 0032", () => {
    expect(RENDU_MAX_OCTETS).toBe(20971520);
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(formatDeRendu("Tableau.XLSX", zip)).toBe(XLSX);
    expect(formatDeRendu("notes.txt", new Uint8Array([0x41]))).toBeNull();
    expect(formatDeRendu("faux.pdf", zip)).toBeNull();
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/0032_exercices.sql"), "utf8");
    const liste = migration.slice(migration.indexOf("select array["), migration.indexOf("]::text[]"));
    expect([...liste.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual([...FORMATS_RENDU].sort());
  });
});
