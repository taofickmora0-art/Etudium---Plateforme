import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Les actions des discussions d'une leçon (refonte des formations, étape B, migration 0028) et la file de modération.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { aimerCommentaireLecon, chargerDiscussion, commenterLecon, modifierCommentaireLecon, signalerCommentaireLecon, supprimerCommentaireLecon } = await import(
  "@/lib/lecon/discussions"
);
const { lireDiscussion } = await import("@/lib/lecon/data");
const { garderContenu, supprimerContenu } = await import("@/lib/moderation/actions");
const { versElement } = await import("@/lib/moderation/data");

const L = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
// Avant la 0028 : un message neutre, sans migration ni guide.
const INDISPONIBLE = "Cette fonction n’est pas disponible pour le moment.";
const CARTE = {
  id: C,
  auteur: { prenom: "Mireille", nom_court: "Mireille A." },
  est_moi: false,
  texte: "Dans les documents.",
  cree_le: "2026-10-15T10:00:00Z",
  parent_id: null,
  modifie: false,
  reactions: 2,
  j_aime: true,
  peut_modifier: false,
  peut_supprimer: false,
  peut_signaler: true,
  formateur: true,
};

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockReset().mockResolvedValue({ prenom: "Koffi", nom: "Dossou", roles: ["etudiant"] });
});

describe("Les discussions d'une leçon", () => {
  it("lire : la première page à l'ouverture, tout avec « Voir plus » ; l'étiquette Formateur ; sans accès : null", async () => {
    faux.repondre("rpc.discussion_lecon", { data: { total: 3, commentaires: [CARTE] } });
    expect(await lireDiscussion(L)).toEqual({ total: 3, reponses: [expect.objectContaining({ id: C, formateur: true, jAime: true, reactions: 2 })] });
    expect(faux.de("rpc", "discussion_lecon")[0].valeurs).toEqual({ p_lecon: L, p_tout: false });
    expect(await chargerDiscussion(L)).toMatchObject({ ok: true, reponses: [{ id: C }] });
    expect(faux.de("rpc", "discussion_lecon")[1].valeurs).toEqual({ p_lecon: L, p_tout: true });
    faux.repondre("rpc.discussion_lecon", { data: null });
    expect(await lireDiscussion(L)).toBeNull();
    faux.repondre("rpc.discussion_lecon", { error: { code: "PGRST202" } });
    expect(await lireDiscussion(L)).toBeNull();
    expect(await chargerDiscussion(L)).toEqual({ ok: false, message: INDISPONIBLE });
  });

  it("commenter et répondre : le texte nettoyé, la carte rendue ; vide ou mal formé : refusé sans appel", async () => {
    faux.repondre("rpc.commenter_lecon", { data: { ...CARTE, est_moi: true, formateur: false } });
    expect(await commenterLecon(L, "  Merci !  ", C)).toMatchObject({ ok: true, reponse: { id: C, estMoi: true } });
    expect(faux.de("rpc", "commenter_lecon")[0].valeurs).toEqual({ p_lecon: L, p_texte: "Merci !", p_parent: C });
    expect(refresh).toHaveBeenCalled();
    faux.vider();
    expect(await commenterLecon(L, "   ")).toMatchObject({ ok: false });
    expect(await commenterLecon("abc", "Bonjour")).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.commenter_lecon", { error: { code: "P0001", message: "Les commentaires sont fermés sur cette leçon." } });
    expect(await commenterLecon(L, "Bonjour")).toEqual({ ok: false, message: "Les commentaires sont fermés sur cette leçon." });
    getShellUser.mockResolvedValue(null);
    expect(await commenterLecon(L, "Bonjour")).toMatchObject({ ok: false });
  });

  it("modifier, aimer, supprimer, signaler : les bons appels", async () => {
    expect(await modifierCommentaireLecon(C, " Corrigé ")).toEqual({ ok: true });
    expect(faux.de("rpc", "modifier_commentaire_lecon")[0].valeurs).toEqual({ p_id: C, p_texte: "Corrigé" });
    faux.repondre("rpc.basculer_reaction_commentaire_lecon", { data: { j_aime: true, reactions: 4 } });
    expect(await aimerCommentaireLecon(C)).toEqual({ ok: true, jAime: true, reactions: 4 });
    faux.repondre("rpc.supprimer_commentaire_lecon", { data: 3 });
    expect(await supprimerCommentaireLecon(C)).toEqual({ ok: true, supprimes: 3 });
    expect(await signalerCommentaireLecon(C, "spam", "")).toEqual({ ok: true });
    expect(faux.de("rpc", "signaler_commentaire_lecon")[0].valeurs).toEqual({ p_id: C, p_motif: "spam", p_precisions: "" });
    expect(await signalerCommentaireLecon(C, "autre", "  ")).toMatchObject({ ok: false });
  });
});

describe("Un commentaire de leçon dans la file de modération", () => {
  beforeEach(() => getShellUser.mockResolvedValue({ prenom: "Awa", nom: "K", roles: ["etudiant", "moderateur"] }));

  it("l'élément porte son type et son lien ; garder et retirer appellent leurs fonctions", async () => {
    const e = versElement({ type: "commentaire_lecon", id: C, publication_id: null, lien: `/formations/excel/lecons/${L}#commentaire-${C}`, espace: { id: null, nom: "Excel" }, auteur: { id: "a", prenom: "A", nom: "B" }, texte: "x", statut: "publiee", extrait: "Installer", signalements: { nombre: 1, motifs: [], details: [] } });
    expect(e).toMatchObject({ type: "commentaire_lecon", lien: `/formations/excel/lecons/${L}#commentaire-${C}`, extrait: "Installer" });
    expect(await garderContenu({ commentaireLeconId: C })).toEqual({ ok: true });
    expect(faux.de("rpc", "garder_commentaire_lecon")[0].valeurs).toEqual({ p_id: C });
    expect(await supprimerContenu({ commentaireLeconId: C })).toEqual({ ok: true });
    expect(faux.de("rpc", "retirer_commentaire_lecon")[0].valeurs).toEqual({ p_id: C });
    expect(faux.de("rpc", "supprimer_contenu")).toEqual([]);
  });
});
