import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures de la communauté (migration 0019) ; les fichiers joints arrivent avec un lien temporaire.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { lireEspaces, lireFil, lireMembresActifs, lirePublication } = await import("@/lib/communaute/data");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const CHEMIN = "moi/affiche.png";
const BRUTE = {
  id: ID,
  auteur: { prenom: "Koffi", nom: "Dossou", role: null },
  est_moi: false,
  espace: { id: P, nom: "Académique" },
  titre: "Une question",
  texte: "Le texte",
  piece_jointe: { chemin: CHEMIN, nom: "affiche.png", type: "image/png", taille: 245760 },
  cree_le: "2026-10-14T10:00:00+00:00",
  modifiee: true,
  reactions: 24,
  j_aime: true,
  reponses: 2,
  dernieres_reponses: [{ id: "r1", auteur: { prenom: "Mireille", nom_court: "Mireille A." }, est_moi: false, texte: "Très bon plan.", cree_le: "2026-10-14T11:00:00+00:00", peut_supprimer: false }],
  peut_supprimer: false,
};
const CONVERTIE = {
  id: ID,
  auteur: { prenom: "Koffi", nom: "Dossou", role: null },
  estMoi: false,
  espace: { id: P, nom: "Académique" },
  titre: "Une question",
  texte: "Le texte",
  pieceJointe: { chemin: CHEMIN, nom: "affiche.png", type: "image/png", taille: 245760, url: "https://stockage/affiche.png?jeton" },
  creeLe: "2026-10-14T10:00:00+00:00",
  modifiee: true,
  reactions: 24,
  jAime: true,
  reponses: 2,
  dernieresReponses: [{ id: "r1", auteur: { prenom: "Mireille", nomCourt: "Mireille A." }, estMoi: false, texte: "Très bon plan.", creeLe: "2026-10-14T11:00:00+00:00", peutSupprimer: false }],
  peutSupprimer: false,
};

beforeEach(() => faux.vider());

describe("Lectures de la communauté", () => {
  it("les espaces, convertis", async () => {
    faux.repondre("rpc.espaces_communaute", {
      data: [
        { id: null, nom: "Général", nom_court: "Général", couleur: null, slug: null, ouvert: true },
        { id: P, nom: "Réussite académique", nom_court: "Académique", couleur: "academique", slug: "reussite-academique", ouvert: false },
      ],
    });
    expect(await lireEspaces()).toEqual({
      migrationAbsente: false,
      donnees: [
        { id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true },
        { id: P, nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", slug: "reussite-academique", ouvert: false },
      ],
    });
  });

  it("le fil : conversion, curseur transmis, un seul appel de liens temporaires pour les fichiers", async () => {
    faux.repondre("rpc.fil_communaute", { data: { publications: [BRUTE, { ...BRUTE, id: "b", piece_jointe: null }], suite: true } });
    faux.repondre("storage.communaute.createSignedUrls", { data: [{ path: CHEMIN, signedUrl: "https://stockage/affiche.png?jeton", error: null }] });
    expect(await lireFil("tous", { avant: "2026-10-14T09:00:00Z", avantId: ID })).toEqual({
      migrationAbsente: false,
      donnees: { publications: [CONVERTIE, { ...CONVERTIE, id: "b", pieceJointe: null }], suite: true },
    });
    expect(faux.de("rpc", "fil_communaute")[0].valeurs).toEqual({ p_espace: "tous", p_avant: "2026-10-14T09:00:00Z", p_avant_id: ID, p_nombre: 20 });
    expect(faux.de("storage.communaute", "createSignedUrls")).toHaveLength(1);
    expect(faux.de("storage.communaute", "createSignedUrls")[0].valeurs).toEqual([[CHEMIN], 3600]);
  });

  it("un lien temporaire qui échoue : url nulle, la publication reste", async () => {
    faux.repondre("rpc.fil_communaute", { data: { publications: [BRUTE], suite: false } });
    faux.repondre("storage.communaute.createSignedUrls", { error: { message: "panne" } });
    const lecture = await lireFil(P);
    expect(lecture.migrationAbsente ? null : lecture.donnees.publications[0].pieceJointe?.url).toBeNull();
  });

  it("une publication et toutes ses réponses ; identifiant mal formé : null sans appel ; membres actifs", async () => {
    faux.repondre("rpc.publication_communaute", { data: { ...BRUTE, piece_jointe: null, toutes_reponses: BRUTE.dernieres_reponses } });
    expect(await lirePublication(ID)).toEqual({ migrationAbsente: false, donnees: { ...CONVERTIE, pieceJointe: null, toutesReponses: CONVERTIE.dernieresReponses } });
    faux.vider();
    expect(await lirePublication("abc")).toEqual({ migrationAbsente: false, donnees: null });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.membres_actifs", { data: [{ prenom: "Koffi", nom_court: "Koffi D.", initiales: "KD", espace: "Académique" }] });
    expect(await lireMembresActifs()).toEqual({ migrationAbsente: false, donnees: [{ prenom: "Koffi", nomCourt: "Koffi D.", initiales: "KD", espace: "Académique" }] });
  });

  it("avant la 0019 : migrationAbsente ; toute autre erreur est relancée", async () => {
    faux.repondre("rpc.espaces_communaute", { error: { code: "PGRST202" } });
    expect(await lireEspaces()).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.fil_communaute", { error: { code: "500", message: "panne" } });
    await expect(lireFil("tous")).rejects.toThrow();
  });
});
