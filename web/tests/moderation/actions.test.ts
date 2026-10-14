import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCES_EQUIPE } from "@/lib/admin/garde";
import { fauxSupabase } from "../admin/faux-supabase";

// Actions de l'équipe sur la file de modération (migration 0020).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { chargerFile, garderContenu, reglerAnalyse, retablirPublication, supprimerContenu } = await import("@/lib/moderation/actions");

const ID = "11111111-1111-4111-8111-111111111111";
const R = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ prenom: "Awa", nom: "K", roles: ["etudiant", "moderateur"] });
});
afterEach(() => vi.unstubAllEnvs());

describe("Actions de modération", () => {
  it("hors équipe : refusé sans appel", async () => {
    getShellUser.mockResolvedValue({ prenom: "Koffi", nom: "D", roles: ["etudiant"] });
    expect(await garderContenu({ publicationId: ID })).toEqual({ ok: false, message: ACCES_EQUIPE });
    expect(await reglerAnalyse(false)).toEqual({ ok: false, message: ACCES_EQUIPE });
    expect(await chargerFile("a_examiner")).toEqual({ ok: false, message: ACCES_EQUIPE });
    expect(faux.appels).toEqual([]);
  });

  it("garder, supprimer (le fichier retiré), rétablir ; le message de la base", async () => {
    expect(await garderContenu({ publicationId: ID })).toEqual({ ok: true });
    expect(faux.de("rpc", "garder_contenu")[0].valeurs).toEqual({ p_publication: ID, p_commentaire: null });
    expect(await garderContenu({ reponseId: R })).toEqual({ ok: true });
    expect(faux.de("rpc", "garder_contenu")[1].valeurs).toEqual({ p_publication: null, p_commentaire: R });
    faux.repondre("rpc.supprimer_contenu", { data: "a1/x.png" });
    expect(await supprimerContenu({ publicationId: ID })).toEqual({ ok: true });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([["a1/x.png"]]);
    faux.repondre("rpc.supprimer_contenu", { data: null });
    expect(await supprimerContenu({ reponseId: R })).toEqual({ ok: true });
    expect(faux.de("storage.communaute", "remove")).toHaveLength(1);
    expect(await retablirPublication(ID)).toEqual({ ok: true });
    expect(faux.de("rpc", "retablir_publication")[0].valeurs).toEqual({ p_id: ID });
    expect(refresh).toHaveBeenCalled();
    faux.repondre("rpc.retablir_publication", { error: { code: "P0001", message: "Ce contenu n’existe plus." } });
    expect(await retablirPublication(ID)).toEqual({ ok: false, message: "Ce contenu n’existe plus." });
  });

  it("supprimer une publication avec un sondage à images : ses images quittent aussi le stockage (revue finale, I1)", async () => {
    faux.repondre("rpc.images_sondage", { data: ["a1/rouge.png", "a1/bleu.png"] });
    faux.repondre("rpc.supprimer_contenu", { data: null });
    expect(await supprimerContenu({ publicationId: ID })).toEqual({ ok: true });
    expect(faux.de("rpc", "images_sondage")[0].valeurs).toEqual({ p_publication: ID });
    expect(faux.de("storage.communaute", "remove").map((a) => a.valeurs)).toEqual([[["a1/rouge.png", "a1/bleu.png"]]]);
    // Un commentaire n'a pas de sondage : aucune lecture.
    faux.vider();
    faux.repondre("rpc.supprimer_contenu", { data: null });
    expect(await supprimerContenu({ reponseId: R })).toEqual({ ok: true });
    expect(faux.de("rpc", "images_sondage")).toEqual([]);
  });

  it("régler l'analyse : le jeton du serveur ; sans configuration, le guide", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("MODERATION_JETON", "J");
    expect(await reglerAnalyse(true)).toEqual({ ok: false, message: "Ajoutez la clé de l’IA et le jeton de modération (guide, section 25)." });
    expect(faux.appels).toEqual([]);
    vi.stubEnv("ANTHROPIC_API_KEY", "k");
    expect(await reglerAnalyse(true)).toEqual({ ok: true });
    expect(faux.de("rpc", "regler_analyse")[0].valeurs).toEqual({ p_active: true, p_jeton: "J" });
    expect(await reglerAnalyse(false)).toEqual({ ok: true });
    expect(faux.de("rpc", "regler_analyse")[1].valeurs).toEqual({ p_active: false, p_jeton: null });
    faux.repondre("rpc.regler_analyse", { error: { code: "P0001", message: "Le jeton de modération n’est pas reconnu." } });
    expect(await reglerAnalyse(true)).toEqual({ ok: false, message: "Le jeton de modération n’est pas reconnu." });
  });

  it("chargerFile : un onglet, converti", async () => {
    faux.repondre("rpc.file_moderation", { data: [] });
    expect(await chargerFile("bloquees")).toEqual({ ok: true, elements: [] });
    expect(faux.de("rpc", "file_moderation")[0].valeurs).toEqual({ p_onglet: "bloquees" });
  });
});
