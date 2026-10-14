import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures de la file de modération (migration 0020) : les éléments, l'état de l'analyse, le nombre à examiner.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { lireEtatModeration, lireFileModeration, lireNombreAExaminer } = await import("@/lib/moderation/data");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const BRUT = {
  type: "publication",
  id: ID,
  publication_id: ID,
  espace: { id: P, nom: "Académique" },
  auteur: { id: "a1", prenom: "Jules", nom: "Kossou" },
  cree_le: "2026-10-14T10:00:00Z",
  titre: "Gagnez vite",
  texte: "Cliquez ici",
  piece_jointe: { chemin: "a1/x.png", nom: "x.png", type: "image/png", taille: 1000 },
  statut: "publiee",
  analyse: { decision: "signaler", categorie: "arnaque", raison: "Lien suspect", le: "2026-10-14T10:00:01Z" },
  extrait: null,
  signalements: {
    nombre: 3,
    motifs: [
      { motif: "spam", nombre: 2 },
      { motif: "harcelement", nombre: 1 },
    ],
    details: [{ motif: "spam", precisions: "Pub", par: "Koffi D.", le: "2026-10-14T11:00:00Z" }],
  },
};

beforeEach(() => faux.vider());
afterEach(() => vi.unstubAllEnvs());

describe("Lectures de la modération", () => {
  it("un élément converti, une réponse ; liens temporaires en un seul appel", async () => {
    faux.repondre("rpc.file_moderation", {
      data: [BRUT, { ...BRUT, type: "reponse", id: "r1", titre: "", texte: "Insulte", piece_jointe: null, analyse: null, extrait: "Normal", signalements: { nombre: 1, motifs: [], details: [] } }],
    });
    faux.repondre("storage.communaute.createSignedUrls", { data: [{ path: "a1/x.png", signedUrl: "https://stockage/x.png?jeton", error: null }] });
    const lecture = await lireFileModeration("a_examiner");
    expect(faux.de("rpc", "file_moderation")[0].valeurs).toEqual({ p_onglet: "a_examiner" });
    expect(faux.de("storage.communaute", "createSignedUrls")[0].valeurs).toEqual([["a1/x.png"], 3600]);
    expect(lecture).toEqual({
      migrationAbsente: false,
      donnees: [
        {
          type: "publication",
          id: ID,
          publicationId: ID,
          espace: { id: P, nom: "Académique" },
          auteur: { id: "a1", prenom: "Jules", nom: "Kossou" },
          creeLe: "2026-10-14T10:00:00Z",
          titre: "Gagnez vite",
          texte: "Cliquez ici",
          pieceJointe: { chemin: "a1/x.png", nom: "x.png", type: "image/png", taille: 1000, url: "https://stockage/x.png?jeton" },
          statut: "publiee",
          analyse: { decision: "signaler", categorie: "arnaque", raison: "Lien suspect" },
          extrait: null,
          signalements: {
            nombre: 3,
            motifs: [
              { motif: "spam", nombre: 2 },
              { motif: "harcelement", nombre: 1 },
            ],
            details: [{ motif: "spam", precisions: "Pub", par: "Koffi D.", le: "2026-10-14T11:00:00Z" }],
          },
        },
        {
          type: "reponse",
          id: "r1",
          publicationId: ID,
          espace: { id: P, nom: "Académique" },
          auteur: { id: "a1", prenom: "Jules", nom: "Kossou" },
          creeLe: "2026-10-14T10:00:00Z",
          titre: "",
          texte: "Insulte",
          pieceJointe: null,
          statut: "publiee",
          analyse: null,
          extrait: "Normal",
          signalements: { nombre: 1, motifs: [], details: [] },
        },
      ],
    });
  });

  it("état : la clé et le jeton du serveur (absent, non reconnu, reconnu)", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MODERATION_JETON", "");
    faux.repondre("rpc.etat_moderation", { data: { active: false, jeton_reconnu: null, derniere_analyse: null, en_attente: 0 } });
    expect(await lireEtatModeration()).toEqual({ migrationAbsente: false, donnees: { active: false, cle: false, jeton: "absent", derniereAnalyse: null, enAttente: 0 } });
    expect(faux.de("rpc", "etat_moderation")[0].valeurs).toEqual({ p_jeton: null });
    faux.vider();
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    vi.stubEnv("MODERATION_JETON", "J");
    faux.repondre("rpc.etat_moderation", { data: { active: true, jeton_reconnu: false, derniere_analyse: "2026-10-14T10:00:00Z", en_attente: 2 } });
    expect(await lireEtatModeration()).toEqual({
      migrationAbsente: false,
      donnees: { active: true, cle: true, jeton: "non_reconnu", derniereAnalyse: "2026-10-14T10:00:00Z", enAttente: 2 },
    });
    expect(faux.de("rpc", "etat_moderation")[0].valeurs).toEqual({ p_jeton: "J" });
    faux.repondre("rpc.etat_moderation", { data: { active: true, jeton_reconnu: true, derniere_analyse: null, en_attente: 0 } });
    const lecture = await lireEtatModeration();
    expect(lecture.migrationAbsente ? null : lecture.donnees.jeton).toBe("reconnu");
  });

  it("avant la 0020 : migrationAbsente ; nombre à examiner null ; une autre erreur est relancée", async () => {
    faux.repondre("rpc.etat_moderation", { error: { code: "PGRST202" } });
    expect(await lireEtatModeration()).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.file_moderation", { error: { code: "PGRST202" } });
    expect(await lireFileModeration("bloquees")).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.nombre_a_examiner", { error: { code: "PGRST202" } });
    expect(await lireNombreAExaminer()).toBeNull();
    faux.repondre("rpc.nombre_a_examiner", { data: 4 });
    expect(await lireNombreAExaminer()).toBe(4);
    faux.repondre("rpc.file_moderation", { error: { code: "500", message: "panne" } });
    await expect(lireFileModeration("a_examiner")).rejects.toThrow();
  });
});
