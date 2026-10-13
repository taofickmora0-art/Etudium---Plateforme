import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { id } from "../lecon/donnees";

const faux = fauxSupabase();
let compte: { id: string } | null = { id: "compte-1" };
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...faux.client, auth: { getUser: async () => ({ data: { user: compte }, error: null }) } }),
}));

const { lireAvis, lireAvisEquipe } = await import("@/lib/avis/data");
const { enregistrerAvis, supprimerAvis, masquerAvis } = await import("@/lib/avis/actions");

const LIGNE = {
  id: id(1),
  note: 4,
  commentaire: "Très clair.",
  auteur: "Fifamè A.",
  initiales: "FA",
  cree_le: "2026-10-12T10:00:00Z",
  modifie_le: "2026-10-13T10:00:00Z",
  est_moi: true,
  masque: false,
};

describe("Avis : lecture", () => {
  beforeEach(() => faux.vider());

  it("les avis d'une formation et leur résumé, par deux fonctions de la base", async () => {
    faux.repondre("rpc.avis_formation", { data: [LIGNE] });
    faux.repondre("rpc.repartition_avis", { data: [{ note: 5, nombre: 3 }, { note: 4, nombre: 1 }] });
    expect(await lireAvis(id(9))).toEqual({
      avis: [{ id: id(1), note: 4, commentaire: "Très clair.", auteur: "Fifamè A.", initiales: "FA", creeLe: "2026-10-12T10:00:00Z", modifieLe: "2026-10-13T10:00:00Z", estMoi: true, masque: false }],
      resume: { moyenne: 4.8, total: 4, repartition: { 5: 3, 4: 1, 3: 0, 2: 0, 1: 0 } },
    });
    expect(faux.de("rpc", "avis_formation")[0].valeurs).toEqual({ p_formation: id(9), p_limite: 6 });
    expect(faux.de("rpc", "repartition_avis")[0].valeurs).toEqual({ p_formation: id(9) });
  });

  it("sans la migration 0010 (fonction absente) : null, la fiche garde « Pas encore d’avis »", async () => {
    faux.repondre("rpc.avis_formation", { error: { code: "PGRST202" } });
    faux.repondre("rpc.repartition_avis", { error: { code: "PGRST202" } });
    expect(await lireAvis(id(9))).toBeNull();
    faux.repondre("rpc.avis_formation", { error: { code: "42883" } });
    expect(await lireAvis(id(9))).toBeNull();
  });

  it("les avis de l'équipe ; null sans la 0010", async () => {
    faux.repondre("rpc.avis_equipe", {
      data: [{ id: id(1), formation_titre: "Maîtriser Microsoft Excel", formation_slug: "maitriser-microsoft-excel", auteur: "Fifamè A.", note: 4, commentaire: "", masque: true, cree_le: "2026-10-12T10:00:00Z" }],
    });
    expect(await lireAvisEquipe()).toEqual([
      { id: id(1), formationTitre: "Maîtriser Microsoft Excel", formationSlug: "maitriser-microsoft-excel", auteur: "Fifamè A.", note: 4, commentaire: "", masque: true, creeLe: "2026-10-12T10:00:00Z" },
    ]);
    faux.repondre("rpc.avis_equipe", { error: { code: "PGRST202" } });
    expect(await lireAvisEquipe()).toBeNull();
  });
});

describe("Avis : actions", () => {
  beforeEach(() => {
    faux.vider();
    compte = { id: "compte-1" };
    refresh.mockReset();
  });

  it("enregistrer : la base reçoit la note et le commentaire, puis la page est relue", async () => {
    expect(await enregistrerAvis(id(9), 4, "Très clair.")).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_avis")[0].valeurs).toEqual({ p_formation: id(9), p_note: 4, p_commentaire: "Très clair." });
    expect(refresh).toHaveBeenCalled();
  });

  it("enregistrer : refus avant la base (note, longueur, compte, identifiant) et messages de la base", async () => {
    expect(await enregistrerAvis(id(9), 0, "")).toEqual({ ok: false, erreur: "Choisissez une note de 1 à 5 étoiles." });
    expect(await enregistrerAvis(id(9), 5, "a".repeat(1001))).toEqual({ ok: false, erreur: "Votre commentaire dépasse 1 000 caractères." });
    expect(await enregistrerAvis(id(9), 5, `  ${"a".repeat(1000)}  `)).toEqual({ ok: true });
    expect(await enregistrerAvis("abc", 5, "")).toEqual({ ok: false, erreur: "Votre avis n’a pas pu être enregistré. Réessayez." });
    faux.repondre("rpc.enregistrer_avis", { error: { code: "42501" } });
    expect(await enregistrerAvis(id(9), 5, "")).toEqual({ ok: false, erreur: "Vous pourrez laisser un avis à partir de 50 % de progression." });
    faux.repondre("rpc.enregistrer_avis", { error: { code: "XX000" } });
    expect(await enregistrerAvis(id(9), 5, "")).toEqual({ ok: false, erreur: "Votre avis n’a pas pu être enregistré. Réessayez." });
    compte = null;
    expect(await enregistrerAvis(id(9), 5, "")).toEqual({ ok: false, erreur: "Connectez-vous pour laisser un avis." });
  });

  it("supprimer son avis ; masquer ou réafficher (équipe)", async () => {
    expect(await supprimerAvis(id(9))).toEqual({ ok: true });
    expect(faux.de("rpc", "supprimer_avis")[0].valeurs).toEqual({ p_formation: id(9) });
    expect(await masquerAvis(id(1), true)).toEqual({ ok: true });
    expect(faux.de("rpc", "masquer_avis")[0].valeurs).toEqual({ p_avis: id(1), p_masque: true });
    faux.repondre("rpc.supprimer_avis", { error: { code: "XX000" } });
    expect(await supprimerAvis(id(9))).toEqual({ ok: false, erreur: "Votre avis n’a pas pu être supprimé. Réessayez." });
    faux.repondre("rpc.masquer_avis", { error: { code: "42501" } });
    expect(await masquerAvis(id(1), false)).toEqual({ ok: false, erreur: "L’avis n’a pas pu être modifié. Réessayez." });
  });
});
