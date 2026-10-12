import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { addRessource, updateRessource, deleteRessource } = await import("@/lib/admin/actions");

const F = "11111111-1111-4111-8111-111111111111";
const L = "33333333-3333-4333-8333-333333333333";
const R = "44444444-4444-4444-8444-444444444444";
const EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const FICHIER = `${F}/0b6f1c3e-9a7d-4c1e-8f2a-1d2e3f4a5b6c.pdf`;

describe("Back-office : ressources d'une leçon", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockReset();
    getShellUser.mockResolvedValue({ roles: ["admin"] });
    faux.repondre("lecons.select", { data: { modules: { formation_id: F } } });
  });

  it("une ressource est enregistrée après l'envoi de son fichier, à la fin de la liste", async () => {
    faux.repondre("ressources.select", { data: { ordre: 1 } });
    const resultat = await addRessource({ leconId: L, titre: "Guide des tableaux croisés", fichier: FICHIER, format: "application/pdf", tailleOctets: 1200000 });
    expect(resultat).toEqual({ ok: true });
    expect(faux.de("ressources", "insert")[0].valeurs).toEqual({
      lecon_id: L,
      titre: "Guide des tableaux croisés",
      fichier: FICHIER,
      format: "application/pdf",
      taille_octets: 1200000,
      telechargeable: true,
      ordre: 2,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("un fichier hors du dossier de la formation est refusé", async () => {
    for (const fichier of ["autre-formation/x.pdf", `${F}/../autre/x.pdf`, `${F}/sous/dossier.pdf`]) {
      expect(await addRessource({ leconId: L, titre: "X", fichier, format: "application/pdf", tailleOctets: 10 }), fichier).toEqual({
        ok: false,
        message: "Ce fichier n’est pas dans le dossier de la formation.",
      });
    }
    expect(faux.de("ressources", "insert")).toEqual([]);
  });

  it("un format inconnu ou un fichier trop lourd est refusé", async () => {
    expect((await addRessource({ leconId: L, titre: "X", fichier: FICHIER, format: "application/x-msdownload", tailleOctets: 10 })).ok).toBe(false);
    expect((await addRessource({ leconId: L, titre: "X", fichier: FICHIER, format: "application/pdf", tailleOctets: 52428801 })).message).toBe(
      "Ce fichier dépasse 50 Mo.",
    );
    expect(faux.de("ressources", "insert")).toEqual([]);
  });

  it("un fichier Excel ne passe pas en consultation seule", async () => {
    faux.repondre("ressources.select", { data: { format: EXCEL } });
    expect(await updateRessource({ id: R, titre: "Données", telechargeable: false })).toEqual({
      ok: false,
      message: "Seuls les PDF et les images peuvent être en consultation seule.",
    });
    expect(faux.de("ressources", "update")).toEqual([]);
  });

  it("un PDF passe en consultation seule et change de titre", async () => {
    faux.repondre("ressources.select", { data: { format: "application/pdf" } });
    expect(await updateRessource({ id: R, titre: "Guide", telechargeable: false })).toEqual({ ok: true });
    const [maj] = faux.de("ressources", "update");
    expect(maj.valeurs).toEqual({ titre: "Guide", telechargeable: false });
    expect(maj.filtres).toContainEqual(["eq", "id", R]);
  });

  it("supprimer une ressource retire aussi son fichier", async () => {
    faux.repondre("ressources.select", { data: { fichier: FICHIER } });
    expect(await deleteRessource(R)).toEqual({ ok: true });
    expect(faux.de("ressources", "delete")[0].filtres).toContainEqual(["eq", "id", R]);
    expect(faux.de("storage.ressources", "remove")[0].valeurs).toEqual([[FICHIER]]);
  });

  it("un étudiant n'ajoute ni ne supprime rien", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await addRessource({ leconId: L, titre: "X", fichier: FICHIER, format: "application/pdf", tailleOctets: 10 })).toEqual({
      ok: false,
      message: "Accès réservé à l’équipe.",
    });
    expect(await deleteRessource(R)).toEqual({ ok: false, message: "Accès réservé à l’équipe." });
    expect(faux.appels).toEqual([]);
  });
});
