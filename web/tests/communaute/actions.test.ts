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
const configuration = vi.fn();
const analyserPublication = vi.fn();
vi.mock("@/lib/moderation/analyse", () => ({ configurationModeration: () => configuration(), analyserPublication: (...a: unknown[]) => analyserPublication(...a) }));
const apercuDuTexte = vi.fn();
vi.mock("@/lib/communaute/apercu", () => ({ apercuDuTexte: (...a: unknown[]) => apercuDuTexte(...a) }));

const { aimer, basculerEnregistrement, chargerFil, chargerReponses, modifierPublication, publierPublication, repondre, signaler, supprimerPublication, supprimerReponse } = await import(
  "@/lib/communaute/actions"
);
const { messageBloquee } = await import("@/lib/moderation/regles");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";
const PIECE = { chemin: "moi/affiche.png", nom: "affiche.png", type: "image/png", taille: 245760 };
const FERME = "Cet espace ne vous est pas ouvert.";

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ id: "moi", prenom: "Koffi", nom: "Dossou", roles: ["etudiant"] });
  configuration.mockReset().mockReturnValue(null);
  analyserPublication.mockReset();
  apercuDuTexte.mockReset().mockResolvedValue(null);
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
    expect(await publierPublication(P, " Titre ", " Texte ", PIECE)).toEqual({ ok: true, id: ID, statut: "publiee" });
    expect(faux.de("rpc", "publier")[0].valeurs).toEqual({ p_parcours: P, p_titre: "Titre", p_texte: "Texte", p_piece: PIECE, p_analyse: null });
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
    expect(await modifierPublication(ID, "", "Nouveau")).toEqual({ ok: true, statut: "publiee" });
    expect(faux.de("rpc", "modifier_publication")[0].valeurs).toEqual({ p_id: ID, p_titre: "", p_texte: "Nouveau", p_analyse: null });
    faux.repondre("rpc.supprimer_publication", { data: PIECE.chemin });
    expect(await supprimerPublication(ID)).toEqual({ ok: true });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[PIECE.chemin]]);
    faux.vider();
    faux.repondre("rpc.supprimer_publication", { data: null });
    await supprimerPublication(ID);
    expect(faux.de("storage.communaute", "remove")).toEqual([]);
  });

  it("supprimer depuis la page de la publication : la page n'est pas relue (elle n'existe plus), le fichier est retiré", async () => {
    faux.repondre("rpc.supprimer_publication", { data: PIECE.chemin });
    expect(await supprimerPublication(ID, { relire: false })).toEqual({ ok: true });
    expect(refresh).not.toHaveBeenCalled();
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[PIECE.chemin]]);
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
    expect(await chargerFil(P, "populaires", { page: 1 })).toEqual({ ok: true, lot: { publications: [], suite: false } });
    expect(faux.de("rpc", "fil_communaute")[0].valeurs).toMatchObject({ p_espace: P, p_tri: "populaires", p_page: 1 });
  });

  it("chargerReponses : toutes les réponses d'une publication ; disparue : le message", async () => {
    faux.repondre("rpc.publication_communaute", {
      data: { id: ID, toutes_reponses: [{ id: R, auteur: { prenom: "Awa", nom_court: "Awa K." }, est_moi: false, texte: "Oui", cree_le: "2026-10-14T10:00:00Z", peut_supprimer: false }] },
    });
    expect(await chargerReponses(ID)).toEqual({
      ok: true,
      reponses: [{ id: R, auteur: { prenom: "Awa", nomCourt: "Awa K." }, estMoi: false, texte: "Oui", creeLe: "2026-10-14T10:00:00Z", peutSupprimer: false, peutSignaler: false }],
    });
    expect(faux.de("rpc", "publication_communaute")[0].valeurs).toEqual({ p_id: ID });
    faux.repondre("rpc.publication_communaute", { data: null });
    expect(await chargerReponses(ID)).toEqual({ ok: false, message: "Cette publication n’existe plus." });
  });
});

describe("Avec la modération (migration 0020)", () => {
  const CONFIG = { cle: "k", jeton: "J", modele: "claude-haiku-5-5" };
  const VERDICT = { decision: "autoriser", categorie: "aucune", raison: "RAS" };
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const actif = () => {
    faux.repondre("rpc.moderation_active", { data: true });
    faux.repondre("rpc.espaces_communaute", { data: [{ id: null, nom_court: "Général" }, { id: P, nom_court: "Académique" }] });
    faux.repondre("rpc.preparer_analyse", { data: { objet: null } });
    configuration.mockReturnValue(CONFIG);
    analyserPublication.mockResolvedValue(VERDICT);
  };

  it("analyse inactive : p_analyse null, aucun appel à l'IA ; avant la 0020 : publier sans p_analyse", async () => {
    faux.repondre("rpc.moderation_active", { data: false });
    configuration.mockReturnValue(CONFIG);
    faux.repondre("rpc.publier", { data: { id: ID, statut: "publiee", categorie: null } });
    expect(await publierPublication(null, "", "Texte", null)).toEqual({ ok: true, id: ID, statut: "publiee" });
    expect(faux.de("rpc", "publier")[0].valeurs).toMatchObject({ p_analyse: null });
    expect(analyserPublication).not.toHaveBeenCalled();
    faux.vider();
    faux.repondre("rpc.moderation_active", { error: { code: "PGRST202" } });
    faux.repondre("rpc.publier", { data: ID });
    expect(await publierPublication(null, "", "Texte", null)).toEqual({ ok: true, id: ID, statut: "publiee" });
    expect(faux.de("rpc", "publier")[0].valeurs).not.toHaveProperty("p_analyse");
  });

  it("active et configurée : le fichier relu, le verdict et le jeton transmis ; statut en_attente rendu", async () => {
    actif();
    faux.repondre("rpc.preparer_analyse", { data: { objet: "objet-1" } });
    faux.repondre("storage.communaute.download", { data: new Blob([PNG], { type: "image/png" }) });
    faux.repondre("rpc.publier", { data: { id: ID, statut: "en_attente", categorie: null } });
    expect(await publierPublication(P, " Titre ", " Texte ", { ...PIECE, taille: PNG.length })).toEqual({ ok: true, id: ID, statut: "en_attente" });
    // Avant l'IA, la base vérifie tout et rend l'identifiant du fichier, que le verdict reprend.
    expect(faux.de("rpc", "preparer_analyse")[0].valeurs).toEqual({
      p_publication: null,
      p_parcours: P,
      p_titre: "Titre",
      p_texte: "Texte",
      p_piece: { ...PIECE, taille: PNG.length },
    });
    expect(faux.appels.findIndex((a) => a.op === "preparer_analyse")).toBeLessThan(faux.appels.findIndex((a) => a.op === "download"));
    expect(faux.de("storage.communaute", "download")[0].valeurs).toEqual([PIECE.chemin]);
    expect(analyserPublication).toHaveBeenCalledWith({ titre: "Titre", texte: "Texte", espace: "Académique", fichier: { type: "image/png", octets: PNG } }, CONFIG);
    expect(faux.de("rpc", "publier")[0].valeurs).toMatchObject({ p_analyse: { jeton: "J", ...VERDICT, objet: "objet-1" } });
  });

  it("préparation refusée (limite, fichier déjà joint) : le message, aucun appel à l'IA, le fichier retiré ; aucun verdict (clé refusée) : p_analyse null", async () => {
    actif();
    faux.repondre("rpc.preparer_analyse", { error: { code: "P0001", message: "Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes." } });
    expect(await publierPublication(null, "", "Texte", PIECE)).toEqual({ ok: false, message: "Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes." });
    expect(analyserPublication).not.toHaveBeenCalled();
    expect(faux.de("storage.communaute", "download")).toEqual([]);
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[PIECE.chemin]]);
    expect(faux.de("rpc", "publier")).toEqual([]);
    faux.vider();
    actif();
    analyserPublication.mockResolvedValue(null);
    faux.repondre("rpc.publier", { data: { id: ID, statut: "en_attente", categorie: null } });
    expect(await publierPublication(null, "", "Texte", null)).toEqual({ ok: true, id: ID, statut: "en_attente" });
    expect(faux.de("rpc", "publier")[0].valeurs).toMatchObject({ p_analyse: null });
  });

  it("bloquée : le message de l'auteur, le fichier gardé pour l'équipe ; active sans configuration : p_analyse null", async () => {
    actif();
    faux.repondre("rpc.publier", { data: { id: ID, statut: "bloquee", categorie: "arnaque" } });
    expect(await publierPublication(null, "", "Envoyez 5 000 F", null)).toEqual({ ok: false, message: messageBloquee("arnaque") });
    expect(analyserPublication).toHaveBeenCalledWith({ titre: "", texte: "Envoyez 5 000 F", espace: "général", fichier: null }, CONFIG);
    expect(faux.de("storage.communaute", "remove")).toEqual([]);
    faux.vider();
    analyserPublication.mockClear();
    faux.repondre("rpc.moderation_active", { data: true });
    configuration.mockReturnValue(null);
    faux.repondre("rpc.publier", { data: { id: ID, statut: "en_attente", categorie: null } });
    expect(await publierPublication(null, "", "Texte", null)).toEqual({ ok: true, id: ID, statut: "en_attente" });
    expect(faux.de("rpc", "publier")[0].valeurs).toMatchObject({ p_analyse: null });
    expect(analyserPublication).not.toHaveBeenCalled();
  });

  it("faux fichier : retiré, « Ce fichier n’est pas une image ou un PDF valide. », rien publié ; fichier illisible : analyse impossible", async () => {
    actif();
    faux.repondre("storage.communaute.download", { data: new Blob(["pas une image"], { type: "image/png" }) });
    expect(await publierPublication(null, "", "Texte", PIECE)).toEqual({ ok: false, message: "Ce fichier n’est pas une image ou un PDF valide." });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[PIECE.chemin]]);
    expect(faux.de("rpc", "publier")).toEqual([]);
    faux.vider();
    analyserPublication.mockClear();
    actif();
    faux.repondre("storage.communaute.download", { error: { message: "introuvable" } });
    faux.repondre("rpc.publier", { data: { id: ID, statut: "publiee", categorie: null } });
    await publierPublication(null, "", "Texte", PIECE);
    expect(analyserPublication).not.toHaveBeenCalled();
    expect(faux.de("rpc", "publier")[0].valeurs).toMatchObject({ p_analyse: { jeton: "J", decision: "echec", categorie: "aucune" } });
  });

  it("modifier : préparée (sa publication), le titre et le texte analysés, dans l'espace de la publication ; bloquée → message", async () => {
    actif();
    faux.repondre("rpc.preparer_analyse", { error: { code: "42501", message: "Cette publication n’est pas la vôtre." } });
    expect(await modifierPublication(ID, "Titre", "Achetez")).toEqual({ ok: false, message: "Cette publication n’est pas la vôtre." });
    expect(analyserPublication).not.toHaveBeenCalled();
    expect(faux.de("rpc", "preparer_analyse")[0].valeurs).toEqual({ p_publication: ID, p_parcours: null, p_titre: "Titre", p_texte: "Achetez", p_piece: null });
    faux.vider();
    actif();
    faux.repondre("rpc.publication_communaute", { data: { id: ID, espace: { id: P, nom: "Académique" } } });
    faux.repondre("rpc.modifier_publication", { data: { statut: "bloquee", categorie: "spam" } });
    expect(await modifierPublication(ID, "Titre", "Achetez")).toEqual({ ok: false, message: messageBloquee("spam") });
    expect(analyserPublication).toHaveBeenCalledWith({ titre: "Titre", texte: "Achetez", espace: "Académique", fichier: null }, CONFIG);
    expect(faux.de("rpc", "modifier_publication")[0].valeurs).toMatchObject({ p_analyse: { jeton: "J", ...VERDICT } });
    faux.repondre("rpc.modifier_publication", { data: { statut: "en_attente", categorie: null } });
    expect(await modifierPublication(ID, "Titre", "Corrigé")).toEqual({ ok: true, statut: "en_attente" });
  });

  it("signaler : paramètres, refus local, message de la base", async () => {
    expect(await signaler({ publicationId: ID }, "spam", " Pub ")).toEqual({ ok: true });
    expect(faux.de("rpc", "signaler")[0].valeurs).toEqual({ p_publication: ID, p_commentaire: null, p_motif: "spam", p_precisions: "Pub" });
    faux.vider();
    expect(await signaler({ reponseId: R }, "autre", " ")).toEqual({ ok: false, message: "Précisez le motif du signalement." });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.signaler", { error: { code: "P0001", message: "Vous avez déjà signalé ce contenu." } });
    expect(await signaler({ reponseId: R }, "harcelement", "")).toEqual({ ok: false, message: "Vous avez déjà signalé ce contenu." });
    expect(faux.de("rpc", "signaler")[0].valeurs).toEqual({ p_publication: null, p_commentaire: R, p_motif: "harcelement", p_precisions: "" });
    getShellUser.mockResolvedValue(null);
    expect(await signaler({ publicationId: ID }, "spam", "")).toEqual({ ok: false, message: SESSION_EXPIREE });
  });
});

describe("Le fil Actualités (0021)", () => {
  const VIDEO = { type: "youtube", id: "dQw4w9WgXcQ" };

  it("publier et modifier : l'aperçu du texte transmis ; avant la 0021, sans aperçu", async () => {
    apercuDuTexte.mockResolvedValue(VIDEO);
    faux.repondre("rpc.publier", { data: { id: ID, statut: "publiee", categorie: null } });
    expect(await publierPublication(null, "", "Regardez https://youtu.be/dQw4w9WgXcQ", null)).toEqual({ ok: true, id: ID, statut: "publiee" });
    expect(apercuDuTexte).toHaveBeenCalledWith("Regardez https://youtu.be/dQw4w9WgXcQ");
    expect(faux.de("rpc", "publier")[0].valeurs).toMatchObject({ p_apercu: VIDEO });
    faux.vider();
    let appel = 0;
    faux.repondre("rpc.publier", () => (++appel === 1 ? { error: { code: "PGRST202" } } : { data: ID }));
    expect(await publierPublication(null, "", "Regardez https://youtu.be/dQw4w9WgXcQ", null)).toEqual({ ok: true, id: ID, statut: "publiee" });
    expect(faux.de("rpc", "publier")[1].valeurs).not.toHaveProperty("p_apercu");
    faux.vider();
    faux.repondre("rpc.modifier_publication", { data: { statut: "publiee", categorie: null } });
    expect(await modifierPublication(ID, "", "https://youtu.be/dQw4w9WgXcQ")).toEqual({ ok: true, statut: "publiee" });
    expect(faux.de("rpc", "modifier_publication")[0].valeurs).toMatchObject({ p_apercu: VIDEO });
  });

  it("le signet : bascule ; refus de la base affiché", async () => {
    faux.repondre("rpc.basculer_enregistrement", { data: true });
    expect(await basculerEnregistrement(ID)).toEqual({ ok: true, enregistree: true });
    expect(faux.de("rpc", "basculer_enregistrement")[0].valeurs).toEqual({ p_publication: ID });
    faux.repondre("rpc.basculer_enregistrement", { error: { code: "P0001", message: "Cette publication n’existe plus." } });
    expect(await basculerEnregistrement(ID)).toEqual({ ok: false, message: "Cette publication n’existe plus." });
  });
});
