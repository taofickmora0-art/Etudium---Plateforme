import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lot 3, étape C : la logique des certificats dans l'appli (lectures, QR Code, PDF, réglage « Exercices obligatoires »).
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { lireValidation, lireMesCertificats, lireMonCertificat, verifierCertificat, lireCertificatsFormateur, lireLot3Etudiant, MIGRATION_CERTIFICATS } = await import(
  "@/lib/certificats/data"
);
const { marquerCertificatVu } = await import("@/lib/certificats/actions");
const { matriceQr } = await import("@/lib/certificats/qr");
const { pdfDepuisJpeg } = await import("@/lib/certificats/pdf");
const { adresseVerification, normaliserIdentifiant } = await import("@/lib/certificats/adresse");
const { saveFormationInfos } = await import("@/lib/admin/actions");
const { getFormationAdmin } = await import("@/lib/admin/data");
const { IDLE } = await import("@/lib/auth/schemas");

const F = "33333333-3333-4333-8333-333333333333";
const ID = "ET-2026-K7Q2-M9XD";
const ABSENTE = { error: { code: "PGRST202", message: "Could not find the function" } };
const CERTIFICAT = { identifiant: ID, titulaire: "Aïcha Kpadé", formation: "Excel", formateur: "Dr Mireille Adjovi", parcours: "Réussite académique", delivre_le: "2026-10-15" };
const CERTIFICAT_APP = { identifiant: ID, titulaire: "Aïcha Kpadé", formation: "Excel", formateur: "Dr Mireille Adjovi", parcours: "Réussite académique", delivreLe: "2026-10-15" };

beforeEach(() => {
  faux.vider();
  getShellUser.mockReset().mockResolvedValue({ roles: ["etudiant"] });
});

describe("Les lectures des certificats", () => {
  it("la validation d'une formation, convertie ; introuvable ; avant la 0033", async () => {
    faux.repondre("rpc.validation_formation", {
      data: {
        lecons: { terminees: 2, total: 3 },
        minimum: 70,
        exercices_obligatoires: true,
        quiz: [{ id: "q", titre: "Quiz", meilleur: 75, reussi: true }],
        exercices: [{ id: "x", titre: "Tableau", statut: "en_attente", valide: false }],
        complet: false,
        certificat: { ...CERTIFICAT, vu: false },
      },
    });
    expect(await lireValidation(F)).toEqual({
      migrationAbsente: false,
      donnees: {
        lecons: { terminees: 2, total: 3 },
        minimum: 70,
        exercicesObligatoires: true,
        quiz: [{ id: "q", titre: "Quiz", meilleur: 75, reussi: true }],
        exercices: [{ id: "x", titre: "Tableau", statut: "en_attente", valide: false }],
        complet: false,
        certificat: { ...CERTIFICAT_APP, vu: false },
      },
    });
    expect(faux.de("rpc", "validation_formation")[0].valeurs).toEqual({ p_formation: F });
    faux.vider();
    faux.repondre("rpc.validation_formation", { data: null });
    expect(await lireValidation(F)).toEqual({ migrationAbsente: false, donnees: null });
    faux.vider();
    faux.repondre("rpc.validation_formation", ABSENTE);
    expect(await lireValidation(F)).toEqual({ migrationAbsente: true });
    expect(MIGRATION_CERTIFICATS).toBe("Appliquez la migration 0033 (guide « Ce qui te revient », section 39).");
  });

  it("la page Certificats ; le certificat du titulaire ; la vérification ; les compteurs du formateur", async () => {
    faux.repondre("rpc.mes_certificats", {
      data: {
        obtenus: [{ ...CERTIFICAT, slug: "excel" }],
        en_preparation: [{ formation_id: F, titre: "Word", slug: "word", terminees: 1, total: 4, quiz_restants: 1, exercices_restants: 2 }],
      },
    });
    expect(await lireMesCertificats()).toEqual({
      migrationAbsente: false,
      donnees: {
        obtenus: [{ ...CERTIFICAT_APP, slug: "excel" }],
        enPreparation: [{ formationId: F, titre: "Word", slug: "word", terminees: 1, total: 4, quizRestants: 1, exercicesRestants: 2 }],
      },
    });
    faux.repondre("rpc.mon_certificat", { data: CERTIFICAT });
    expect(await lireMonCertificat(ID)).toEqual(CERTIFICAT_APP);
    faux.repondre("rpc.verifier_certificat", { data: CERTIFICAT });
    expect(await verifierCertificat(" et-2026-k7q2-m9xd ")).toEqual({ migrationAbsente: false, donnees: CERTIFICAT_APP });
    expect(faux.de("rpc", "verifier_certificat")[0].valeurs).toEqual({ p_identifiant: ID });
    faux.repondre("rpc.certificats_formateur", { data: 4 });
    expect(await lireCertificatsFormateur()).toBe(4);
    faux.repondre("rpc.lot3_etudiant", { data: [{ formation_id: F, quiz: [], exercices: [{ id: "x", titre: "Tableau", statut: "valide", valide: true }], certificat: ID }] });
    expect(await lireLot3Etudiant(F)).toEqual([{ formationId: F, quiz: [], exercices: [{ id: "x", titre: "Tableau", statut: "valide", valide: true }], certificat: ID }]);
    faux.vider();
    for (const nom of ["mes_certificats", "mon_certificat", "verifier_certificat", "certificats_formateur", "lot3_etudiant"]) faux.repondre(`rpc.${nom}`, ABSENTE);
    expect(await lireMesCertificats()).toEqual({ migrationAbsente: true });
    expect(await lireMonCertificat(ID)).toBeNull();
    expect(await verifierCertificat(ID)).toEqual({ migrationAbsente: true });
    expect(await lireCertificatsFormateur()).toBeNull();
    expect(await lireLot3Etudiant(F)).toEqual([]);
  });

  it("un identifiant mal formé ne part pas à la base ; « vu » est enregistré", async () => {
    expect(normaliserIdentifiant(" et-2026-k7q2-m9xd ")).toBe(ID);
    expect(normaliserIdentifiant("ET-2026-K7Q2")).toBeNull();
    expect(await verifierCertificat("n'importe quoi")).toEqual({ migrationAbsente: false, donnees: null });
    expect(await lireMonCertificat("../etc")).toBeNull();
    expect(faux.appels).toEqual([]);
    await marquerCertificatVu(ID);
    expect(faux.de("rpc", "marquer_certificat_vu")[0].valeurs).toEqual({ p_identifiant: ID });
    expect(adresseVerification(ID)).toMatch(/\/c\/ET-2026-K7Q2-M9XD$/);
  });
});

describe("Le QR Code et le PDF", () => {
  it("le QR Code : une matrice carrée avec les trois repères aux coins", () => {
    const m = matriceQr("https://etudium.app/c/ET-2026-K7Q2-M9XD");
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((ligne) => ligne.length === m.length)).toBe(true);
    const repere = (l: number, c: number) => [0, 6].every((i) => m[l + i].slice(c, c + 7).every(Boolean)) && m[l + 2][c + 2] && !m[l + 1][c + 1];
    expect(repere(0, 0) && repere(0, m.length - 7) && repere(m.length - 7, 0)).toBe(true);
  });

  it("le PDF : une page A4 paysage qui contient l'image, avec une table des objets juste", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const pdf = pdfDepuisJpeg(jpeg, 1754, 1240);
    const texte = new TextDecoder("latin1").decode(pdf);
    expect(texte.startsWith("%PDF-1.4")).toBe(true);
    expect(texte).toContain("/MediaBox [0 0 842 595]");
    expect(texte).toContain("/Width 1754 /Height 1240");
    expect(texte).toContain("/Filter /DCTDecode /Length 9");
    expect(texte.trimEnd().endsWith("%%EOF")).toBe(true);
    const debutXref = Number(/startxref\n(\d+)/.exec(texte)![1]);
    expect(texte.slice(debutXref, debutXref + 4)).toBe("xref");
    const decalages = [...texte.slice(debutXref).matchAll(/^(\d{10}) 00000 n $/gm)].map((x) => Number(x[1]));
    expect(decalages).toHaveLength(5);
    decalages.forEach((d, i) => expect(texte.slice(d, d + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});

describe("Le réglage « Exercices obligatoires »", () => {
  const INFOS = { id: F, titre: "Excel", slug: "excel", resume: "", description: "", objectifs: "", competences: "", niveau: "debutant", espace: "formateur" };
  const form = (valeurs: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
    return fd;
  };

  it("coché ou non, il part avec les informations ; absent du formulaire, rien n'est envoyé ; avant la 0033, le reste s'enregistre", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    await saveFormationInfos(IDLE, form({ ...INFOS, certification: "1", exercices_obligatoires: "on" }));
    expect(faux.de("formations", "update")[0].valeurs).toMatchObject({ exercices_obligatoires: true });
    faux.vider();
    await saveFormationInfos(IDLE, form({ ...INFOS, certification: "1" }));
    expect(faux.de("formations", "update")[0].valeurs).toMatchObject({ exercices_obligatoires: false });
    faux.vider();
    await saveFormationInfos(IDLE, form(INFOS));
    expect(faux.de("formations", "update")[0].valeurs).not.toHaveProperty("exercices_obligatoires");
    faux.vider();
    faux.repondre("formations.update", (appel) =>
      JSON.stringify(appel.valeurs).includes("exercices_obligatoires") ? { error: { code: "PGRST204", message: "Could not find the 'exercices_obligatoires' column" } } : {},
    );
    expect(await saveFormationInfos(IDLE, form({ ...INFOS, certification: "1", exercices_obligatoires: "on" }))).toMatchObject({
      status: "error",
      fieldErrors: { exercices_obligatoires: "Cette fonction n’est pas disponible pour le moment." },
    });
  });

  it("le back-office le lit ; avant la 0033, il est absent (null)", async () => {
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("exercices_obligatoires")
        ? { data: { id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", score_quiz: 70, exercices_obligatoires: false, modules: [] } }
        : { data: { id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", score_quiz: 70, modules: [] } },
    );
    expect(await getFormationAdmin(F)).toMatchObject({ exercicesObligatoires: false });
    faux.vider();
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("exercices_obligatoires")
        ? { error: { code: "42703", message: "column formations.exercices_obligatoires does not exist" } }
        : { data: { id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", score_quiz: 70, modules: [] } },
    );
    expect(await getFormationAdmin(F)).toMatchObject({ exercicesObligatoires: null });
  });
});
