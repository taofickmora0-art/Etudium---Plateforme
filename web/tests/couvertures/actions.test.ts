import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { enregistrerCouverture, retirerCouverture } = await import("@/lib/admin/actions");

const F = "11111111-1111-4111-8111-111111111111";
const AUTRE = "33333333-3333-4333-8333-333333333333";
const NOUVEAU = `${F}/22222222-2222-4222-8222-222222222222.jpg`;
const ANCIEN = `${F}/44444444-4444-4444-8444-444444444444.png`;

describe("Couvertures : actions du back-office", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
  });

  it("enregistrer : la formation reçoit le chemin, l'ancien fichier est supprimé, la page est relue", async () => {
    faux.repondre("formations.select", { data: { couverture: ANCIEN } });
    expect(await enregistrerCouverture(F, NOUVEAU)).toEqual({ ok: true });
    const [maj] = faux.de("formations", "update");
    expect(maj.valeurs).toEqual({ couverture: NOUVEAU });
    expect(maj.filtres).toContainEqual(["eq", "id", F]);
    expect(faux.de("storage.couvertures", "remove")[0].valeurs).toEqual([[ANCIEN]]);
    expect(refresh).toHaveBeenCalled();
  });

  it("un chemin hors du dossier de la formation est refusé, sans rien toucher", async () => {
    expect(await enregistrerCouverture(F, `${AUTRE}/22222222-2222-4222-8222-222222222222.jpg`)).toEqual({
      ok: false,
      message: "Ce fichier n’est pas dans le dossier de la formation.",
    });
    expect(await enregistrerCouverture("abc", NOUVEAU)).toMatchObject({ ok: false });
    expect(faux.de("formations", "update")).toEqual([]);
  });

  it("si l'ancien fichier ne peut pas être supprimé, l'enregistrement tient quand même", async () => {
    faux.repondre("formations.select", { data: { couverture: ANCIEN } });
    faux.repondre("storage.couvertures.remove", { error: { message: "indisponible" } });
    expect(await enregistrerCouverture(F, NOUVEAU)).toEqual({ ok: true });
  });

  it("retirer : la colonne est vidée, puis le fichier supprimé", async () => {
    faux.repondre("formations.select", { data: { couverture: ANCIEN } });
    expect(await retirerCouverture(F)).toEqual({ ok: true });
    expect(faux.de("formations", "update")[0].valeurs).toEqual({ couverture: null });
    expect(faux.de("storage.couvertures", "remove")[0].valeurs).toEqual([[ANCIEN]]);
  });

  it("réservé à l'équipe", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await enregistrerCouverture(F, NOUVEAU)).toMatchObject({ ok: false });
    expect(await retirerCouverture(F)).toMatchObject({ ok: false });
    expect(faux.de("formations", "update")).toEqual([]);
  });
});
