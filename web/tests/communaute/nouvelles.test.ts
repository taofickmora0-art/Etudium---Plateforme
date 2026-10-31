import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Le compteur du bandeau « Nouvelles publications » (migration 0042, liste du 31 octobre 2026, tâche 9) : le nombre et
// les trois derniers auteurs ; rien (0) sans session, avant la 0042, en erreur ou pour une demande mal formée.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));

const { compterNouvellesPublications } = await import("@/lib/communaute/nouvelles");

const P = "22222222-2222-4222-8222-222222222222";
const CHEMIN = "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333.jpg";
const RIEN = { nombre: 0, auteurs: [] };

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ id: "moi", prenom: "Koffi", nom: "Dossou", roles: ["etudiant"] });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

describe("Les nouvelles publications", () => {
  it("demande l'espace et le repère à la base ; rend le nombre et les auteurs, avec l'adresse de leur photo", async () => {
    faux.repondre("rpc.nouvelles_publications", { data: { nombre: 4, auteurs: [{ initiales: "AK", photo: CHEMIN }, { initiales: "RH", photo: null }] } });
    expect(await compterNouvellesPublications(P, "2026-10-31T10:00:00.000Z")).toEqual({
      nombre: 4,
      auteurs: [
        { initiales: "AK", photoUrl: `https://projet.supabase.co/storage/v1/object/public/photos-profil/${CHEMIN}` },
        { initiales: "RH", photoUrl: null },
      ],
    });
    expect(faux.de("rpc", "nouvelles_publications").map((a) => a.valeurs)).toEqual([{ p_espace: P, p_apres: "2026-10-31T10:00:00.000Z" }]);
  });

  it("un fil vide : sans repère ; un espace ou un repère mal formés : rien, sans appel", async () => {
    faux.repondre("rpc.nouvelles_publications", { data: { nombre: 1, auteurs: [] } });
    expect((await compterNouvellesPublications("tous", null)).nombre).toBe(1);
    expect(faux.de("rpc", "nouvelles_publications").map((a) => a.valeurs)).toEqual([{ p_espace: "tous", p_apres: null }]);
    faux.vider();
    expect(await compterNouvellesPublications("n'importe quoi", null)).toEqual(RIEN);
    expect(await compterNouvellesPublications("general", "hier")).toEqual(RIEN);
    expect(faux.appels).toEqual([]);
  });

  it("rien sans session, avant la 0042, en erreur ou pour une réponse inattendue", async () => {
    faux.repondre("rpc.nouvelles_publications", { error: { code: "PGRST202" } });
    expect(await compterNouvellesPublications("general", null)).toEqual(RIEN);
    faux.repondre("rpc.nouvelles_publications", { data: "n'importe quoi" });
    expect(await compterNouvellesPublications("general", null)).toEqual(RIEN);
    getShellUser.mockResolvedValue(null);
    faux.vider();
    expect(await compterNouvellesPublications("general", null)).toEqual(RIEN);
    expect(faux.appels).toEqual([]);
  });
});
