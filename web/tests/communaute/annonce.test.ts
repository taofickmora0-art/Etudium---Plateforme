import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCES_EQUIPE } from "@/lib/admin/garde";
import { fauxSupabase } from "../admin/faux-supabase";

// L'annonce épinglée de la communauté (migration 0021) : lecture pour les membres, réglage par l'équipe.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { lireAnnonce, lireAnnonceEquipe } = await import("@/lib/communaute/annonce");
const { enregistrerAnnonce, retirerAnnonce } = await import("@/lib/communaute/actions-annonce");

const P = "22222222-2222-4222-8222-222222222222";
const DONNEES = { active: true, titre: " Bienvenue ", texte: "Le texte", media: "youtube" as const, youtube: "https://youtu.be/dQw4w9WgXcQ", imageChemin: null, public: "tous" as const, parcoursId: null };

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ prenom: "Awa", nom: "K", roles: ["etudiant", "admin"] });
});

describe("Lire l'annonce", () => {
  it("pour un membre : convertie, l'affiche avec un lien temporaire ; aucune ou avant la 0021 : null", async () => {
    faux.repondre("rpc.annonce_communaute", { data: { titre: "Bienvenue", texte: "Texte", media: "image", youtube_id: null, image_chemin: "a/affiche.png" } });
    faux.repondre("storage.communaute.createSignedUrl", { data: { signedUrl: "https://stockage/affiche.png?jeton" } });
    expect(await lireAnnonce()).toEqual({ titre: "Bienvenue", texte: "Texte", media: "image", youtubeId: null, image: "https://stockage/affiche.png?jeton" });
    expect(faux.de("storage.communaute", "createSignedUrl")[0].valeurs).toEqual(["a/affiche.png", 3600]);
    faux.repondre("rpc.annonce_communaute", { data: null });
    expect(await lireAnnonce()).toBeNull();
    faux.repondre("rpc.annonce_communaute", { error: { code: "PGRST202" } });
    expect(await lireAnnonce()).toBeNull();
  });

  it("pour l'équipe : tout le réglage ; avant la 0021 : migrationAbsente", async () => {
    faux.repondre("rpc.annonce_equipe", {
      data: { active: true, titre: "Bienvenue", texte: "", media: "youtube", youtube_id: "dQw4w9WgXcQ", image_chemin: null, public: "parcours", parcours_id: P },
    });
    expect(await lireAnnonceEquipe()).toEqual({
      migrationAbsente: false,
      donnees: { active: true, titre: "Bienvenue", texte: "", media: "youtube", youtubeId: "dQw4w9WgXcQ", image: null, imageChemin: null, public: "parcours", parcoursId: P },
    });
    faux.repondre("rpc.annonce_equipe", { error: { code: "PGRST202" } });
    expect(await lireAnnonceEquipe()).toEqual({ migrationAbsente: true });
  });
});

describe("Régler l'annonce", () => {
  it("hors équipe : refusé sans appel ; adresse YouTube lue ; adresse non reconnue refusée sans appel", async () => {
    getShellUser.mockResolvedValue({ prenom: "Koffi", nom: "D", roles: ["etudiant"] });
    expect(await enregistrerAnnonce(DONNEES)).toEqual({ ok: false, message: ACCES_EQUIPE });
    expect(faux.appels).toEqual([]);
    getShellUser.mockResolvedValue({ prenom: "Awa", nom: "K", roles: ["etudiant", "admin"] });
    expect(await enregistrerAnnonce({ ...DONNEES, youtube: "https://exemple.com/video" })).toEqual({ ok: false, message: "Cette adresse YouTube n’est pas reconnue." });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.annonce_equipe", { data: { image_chemin: null } });
    expect(await enregistrerAnnonce(DONNEES)).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_annonce")[0].valeurs).toEqual({
      p_active: true,
      p_titre: "Bienvenue",
      p_texte: "Le texte",
      p_media: "youtube",
      p_youtube_id: "dQw4w9WgXcQ",
      p_image_chemin: null,
      p_public: "tous",
      p_parcours: null,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("une nouvelle affiche : l'ancienne est retirée du stockage ; le message de la base ; retirer l'annonce retire l'affiche", async () => {
    faux.repondre("rpc.annonce_equipe", { data: { image_chemin: "moi/ancienne.png" } });
    expect(await enregistrerAnnonce({ ...DONNEES, media: "image", youtube: "", imageChemin: "moi/nouvelle.png" })).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_annonce")[0].valeurs).toMatchObject({ p_media: "image", p_youtube_id: null, p_image_chemin: "moi/nouvelle.png" });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([["moi/ancienne.png"]]);
    faux.vider();
    faux.repondre("rpc.annonce_equipe", { data: { image_chemin: null } });
    faux.repondre("rpc.enregistrer_annonce", { error: { code: "P0001", message: "Choisissez un parcours." } });
    expect(await enregistrerAnnonce({ ...DONNEES, public: "parcours" })).toEqual({ ok: false, message: "Choisissez un parcours." });
    faux.vider();
    faux.repondre("rpc.retirer_annonce", { data: "moi/nouvelle.png" });
    expect(await retirerAnnonce()).toEqual({ ok: true });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([["moi/nouvelle.png"]]);
  });
});
