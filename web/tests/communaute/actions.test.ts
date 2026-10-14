import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIREE } from "@/lib/admin/garde";
import { fauxSupabase } from "../admin/faux-supabase";

// Actions de la communauté : publier (avec ou sans fichier), modifier, supprimer, répondre, aimer.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { aimer, chargerFil, chargerReponses, modifierPublication, publierPublication, repondre, supprimerPublication, supprimerReponse } = await import("@/lib/communaute/actions");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";
const PIECE = { chemin: "moi/affiche.png", nom: "affiche.png", type: "image/png", taille: 245760 };
const FERME = "Cet espace ne vous est pas ouvert.";

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ id: "moi", prenom: "Koffi", nom: "Dossou", roles: ["etudiant"] });
});

describe("Publier", () => {
  it("refus sans session ; texte vide refusé sans appel ; type de fichier refusé sans appel", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await publierPublication(null, "", "Bonjour", null)).toEqual({ ok: false, message: SESSION_EXPIREE });
    getShellUser.mockResolvedValue({ id: "moi", prenom: "Koffi", nom: "Dossou", roles: ["etudiant"] });
    expect(await publierPublication(null, "", "  ", null)).toEqual({ ok: false, message: "Écrivez votre publication (3 000 caractères au plus)." });
    expect(await publierPublication(null, "", "ok", { ...PIECE, type: "application/zip" })).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
  });

  it("publie : paramètres transmis, la page relue", async () => {
    faux.repondre("rpc.publier", { data: ID });
    expect(await publierPublication(P, " Titre ", " Texte ", PIECE)).toEqual({ ok: true, id: ID });
    expect(faux.de("rpc", "publier")[0].valeurs).toEqual({ p_parcours: P, p_titre: "Titre", p_texte: "Texte", p_piece: PIECE });
    expect(refresh).toHaveBeenCalled();
  });

  it("refusée par la base après l'envoi du fichier : le fichier est retiré, le message affiché", async () => {
    faux.repondre("rpc.publier", { error: { code: "42501", message: FERME } });
    expect(await publierPublication(P, "", "Texte", PIECE)).toEqual({ ok: false, message: FERME });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[PIECE.chemin]]);
  });
});

describe("Modifier, supprimer, répondre, aimer", () => {
  it("modifier : la fonction de la base ; supprimer : retire ensuite le fichier rendu", async () => {
    expect(await modifierPublication(ID, "", "Nouveau")).toEqual({ ok: true });
    expect(faux.de("rpc", "modifier_publication")[0].valeurs).toEqual({ p_id: ID, p_titre: "", p_texte: "Nouveau" });
    faux.repondre("rpc.supprimer_publication", { data: PIECE.chemin });
    expect(await supprimerPublication(ID)).toEqual({ ok: true });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[PIECE.chemin]]);
    faux.vider();
    faux.repondre("rpc.supprimer_publication", { data: null });
    await supprimerPublication(ID);
    expect(faux.de("storage.communaute", "remove")).toEqual([]);
  });

  it("répondre : la réponse est rendue (« Koffi D. ») ; refus de la base affiché ; réponse vide refusée sans appel", async () => {
    faux.repondre("rpc.commenter", { data: "r1" });
    const reponse = await repondre(ID, " Merci ");
    expect(reponse).toMatchObject({ ok: true, reponse: { id: "r1", auteur: { prenom: "Koffi", nomCourt: "Koffi D." }, estMoi: true, texte: "Merci", peutSupprimer: true } });
    expect(faux.de("rpc", "commenter")[0].valeurs).toEqual({ p_publication: ID, p_texte: "Merci" });
    faux.repondre("rpc.commenter", { error: { code: "42501", message: FERME } });
    expect(await repondre(ID, "x")).toEqual({ ok: false, message: FERME });
    faux.vider();
    expect(await repondre(ID, " ")).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
  });

  it("aimer et supprimer une réponse ; le fil d'un onglet", async () => {
    faux.repondre("rpc.basculer_reaction", { data: { j_aime: true, reactions: 25 } });
    expect(await aimer(ID)).toEqual({ ok: true, jAime: true, reactions: 25 });
    expect(await supprimerReponse(R)).toEqual({ ok: true });
    expect(faux.de("rpc", "supprimer_commentaire")[0].valeurs).toEqual({ p_id: R });
    faux.repondre("rpc.fil_communaute", { data: { publications: [], suite: false } });
    expect(await chargerFil(P, null)).toEqual({ ok: true, lot: { publications: [], suite: false } });
  });

  it("chargerReponses : toutes les réponses d'une publication ; disparue : le message", async () => {
    faux.repondre("rpc.publication_communaute", {
      data: { id: ID, toutes_reponses: [{ id: R, auteur: { prenom: "Awa", nom_court: "Awa K." }, est_moi: false, texte: "Oui", cree_le: "2026-10-14T10:00:00Z", peut_supprimer: false }] },
    });
    expect(await chargerReponses(ID)).toEqual({
      ok: true,
      reponses: [{ id: R, auteur: { prenom: "Awa", nomCourt: "Awa K." }, estMoi: false, texte: "Oui", creeLe: "2026-10-14T10:00:00Z", peutSupprimer: false }],
    });
    expect(faux.de("rpc", "publication_communaute")[0].valeurs).toEqual({ p_id: ID });
    faux.repondre("rpc.publication_communaute", { data: null });
    expect(await chargerReponses(ID)).toEqual({ ok: false, message: "Cette publication n’existe plus." });
  });
});
