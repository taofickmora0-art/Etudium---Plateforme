import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures de l'espace formateur (spec de l'espace formateur, §3, §5) : sa fiche, et « cette formation est-elle la sienne ».

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));

const { lireMaFiche, estMaFormation } = await import("@/lib/formateur/data");

const ID = "11111111-1111-4111-8111-111111111111";

describe("Lectures de l'espace formateur", () => {
  beforeEach(() => faux.vider());

  it("sa fiche, aucune fiche, ou la migration 0014 absente", async () => {
    faux.repondre("rpc.ma_fiche_formateur", { data: ID });
    expect(await lireMaFiche()).toEqual({ migrationAbsente: false, fiche: ID });
    faux.repondre("rpc.ma_fiche_formateur", { data: null });
    expect(await lireMaFiche()).toEqual({ migrationAbsente: false, fiche: null });
    faux.repondre("rpc.ma_fiche_formateur", { error: { code: "PGRST202" } });
    expect(await lireMaFiche()).toEqual({ migrationAbsente: true });
  });

  it("une autre erreur est relancée", async () => {
    faux.repondre("rpc.ma_fiche_formateur", { error: { code: "500", message: "panne" } });
    await expect(lireMaFiche()).rejects.toThrow();
  });

  it("est-ce sa formation ? oui, non, et faux sans appel pour un identifiant mal formé", async () => {
    faux.repondre("rpc.formateur_de", { data: true });
    expect(await estMaFormation(ID)).toBe(true);
    expect(faux.de("rpc", "formateur_de")[0].valeurs).toEqual({ p_formation: ID });
    faux.repondre("rpc.formateur_de", { data: false });
    expect(await estMaFormation(ID)).toBe(false);
    faux.repondre("rpc.formateur_de", { error: { code: "PGRST202" } });
    expect(await estMaFormation(ID)).toBe(false);
    faux.vider();
    expect(await estMaFormation("abc")).toBe(false);
    expect(faux.appels).toEqual([]);
  });
});
