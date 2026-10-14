import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures de la communauté (migration 0019) ; les fichiers joints arrivent avec un lien temporaire.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { lireActivites, lireAnalyseActive, lireEspaces, lireFil, lirePublication, lireTendances } = await import("@/lib/communaute/data");

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
  statut: "publiee",
  reactions: 24,
  jAime: true,
  reponses: 2,
  dernieresReponses: [
    { id: "r1", auteur: { prenom: "Mireille", nomCourt: "Mireille A." }, estMoi: false, texte: "Très bon plan.", creeLe: "2026-10-14T11:00:00+00:00", peutSupprimer: false, peutSignaler: false, parentId: null, reactions: 0, jAime: false, modifie: false, peutModifier: false },
  ],
  peutSupprimer: false,
  peutSignaler: false,
  apercu: null,
  enregistree: false,
  aimeePar: [],
  video: null,
  session: null,
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
    expect(await lireFil("tous", "recentes", { curseur: { avant: "2026-10-14T09:00:00Z", avantId: ID } })).toEqual({
      migrationAbsente: false,
      donnees: { publications: [CONVERTIE, { ...CONVERTIE, id: "b", pieceJointe: null }], suite: true },
    });
    expect(faux.de("rpc", "fil_communaute")[0].valeurs).toEqual({ p_espace: "tous", p_tri: "recentes", p_avant: "2026-10-14T09:00:00Z", p_avant_id: ID, p_page: 0, p_nombre: 20 });
    expect(faux.de("storage.communaute", "createSignedUrls")).toHaveLength(1);
    expect(faux.de("storage.communaute", "createSignedUrls")[0].valeurs).toEqual([[CHEMIN], 3600]);
  });

  it("un lien temporaire qui échoue : url nulle, la publication reste", async () => {
    faux.repondre("rpc.fil_communaute", { data: { publications: [BRUTE], suite: false } });
    faux.repondre("storage.communaute.createSignedUrls", { error: { message: "panne" } });
    const lecture = await lireFil(P);
    expect(lecture.migrationAbsente ? null : lecture.donnees.publications[0].pieceJointe?.url).toBeNull();
  });

  it("une publication et toutes ses réponses ; identifiant mal formé : null sans appel", async () => {
    faux.repondre("rpc.publication_communaute", { data: { ...BRUTE, piece_jointe: null, toutes_reponses: BRUTE.dernieres_reponses } });
    expect(await lirePublication(ID)).toEqual({ migrationAbsente: false, donnees: { ...CONVERTIE, pieceJointe: null, toutesReponses: CONVERTIE.dernieresReponses } });
    faux.vider();
    expect(await lirePublication("abc")).toEqual({ migrationAbsente: false, donnees: null });
    expect(faux.appels).toEqual([]);
  });

  it("modération (0020) : statut et peut_signaler convertis ; analyse active lue, fausse avant la 0020", async () => {
    faux.repondre("rpc.fil_communaute", {
      data: { publications: [{ ...BRUTE, piece_jointe: null, statut: "en_attente", peut_signaler: true, dernieres_reponses: [{ ...BRUTE.dernieres_reponses[0], peut_signaler: true }] }], suite: false },
    });
    const lecture = await lireFil("tous");
    expect(lecture.migrationAbsente ? null : lecture.donnees.publications[0]).toMatchObject({ statut: "en_attente", peutSignaler: true, dernieresReponses: [{ peutSignaler: true }] });
    faux.repondre("rpc.moderation_active", { data: true });
    expect(await lireAnalyseActive()).toBe(true);
    faux.repondre("rpc.moderation_active", { error: { code: "PGRST202" } });
    expect(await lireAnalyseActive()).toBe(false);
  });

  it("avant la 0019 : migrationAbsente ; toute autre erreur est relancée", async () => {
    faux.repondre("rpc.espaces_communaute", { error: { code: "PGRST202" } });
    expect(await lireEspaces()).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.fil_communaute", { error: { code: "500", message: "panne" } });
    await expect(lireFil("tous")).rejects.toThrow();
  });

  it("fil Actualités (0021) : aperçu, signet, initiales ; tri et page transmis ; avant la 0021, l'ancien fil", async () => {
    faux.repondre("rpc.fil_communaute", {
      data: {
        publications: [
          { ...BRUTE, piece_jointe: null, apercu: { type: "youtube", id: "dQw4w9WgXcQ" }, enregistree: true, aimee_par: ["KD", "MA"] },
          { ...BRUTE, id: "b", piece_jointe: null, apercu: { type: "lien", url: "https://meet.google.com/x", titre: "Google Meet", description: "Vidéo", image: null } },
          { ...BRUTE, id: "c", piece_jointe: null, apercu: { type: "autre" } },
        ],
        suite: false,
      },
    });
    const lecture = await lireFil(P, "populaires", { page: 2 });
    const publications = lecture.migrationAbsente ? [] : lecture.donnees.publications;
    expect(publications.map((p) => [p.apercu, p.enregistree, p.aimeePar])).toEqual([
      [{ type: "youtube", id: "dQw4w9WgXcQ" }, true, ["KD", "MA"]],
      [{ type: "lien", url: "https://meet.google.com/x", titre: "Google Meet", description: "Vidéo", image: null }, false, []],
      [null, false, []],
    ]);
    expect(faux.de("rpc", "fil_communaute")[0].valeurs).toEqual({ p_espace: P, p_tri: "populaires", p_avant: null, p_avant_id: null, p_page: 2, p_nombre: 20 });
    faux.vider();
    let appel = 0;
    faux.repondre("rpc.fil_communaute", () => (++appel === 1 ? { error: { code: "PGRST202" } } : { data: { publications: [], suite: false } }));
    expect(await lireFil("general")).toEqual({ migrationAbsente: false, donnees: { publications: [], suite: false } });
    expect(faux.de("rpc", "fil_communaute")[1].valeurs).toEqual({ p_espace: "tous", p_avant: null, p_avant_id: null, p_nombre: 20 });
  });

  it("tendances et activités : converties ; avant la 0021 : migrationAbsente", async () => {
    faux.repondre("rpc.publications_tendances", { data: [{ id: ID, extrait: "Mon mémoire est validé !", auteur: { nom_court: "Fifamè A.", initiales: "FA", equipe: false } }] });
    expect(await lireTendances()).toEqual({ migrationAbsente: false, donnees: [{ id: ID, extrait: "Mon mémoire est validé !", auteur: { nomCourt: "Fifamè A.", initiales: "FA", equipe: false } }] });
    faux.repondre("rpc.activites_recentes", {
      data: [{ type: "commentaire", publication_id: ID, auteur: { nom_court: "Koffi D.", initiales: "KD" }, extrait: "Bonjour", cree_le: "2026-10-14T10:00:00Z" }],
    });
    expect(await lireActivites()).toEqual({
      migrationAbsente: false,
      donnees: [{ type: "commentaire", publicationId: ID, auteur: { nomCourt: "Koffi D.", initiales: "KD" }, extrait: "Bonjour", creeLe: "2026-10-14T10:00:00Z" }],
    });
    faux.repondre("rpc.publications_tendances", { error: { code: "PGRST202" } });
    expect(await lireTendances()).toEqual({ migrationAbsente: true });
  });

  it("la vidéo jointe (0022) : relue avec les règles de l'application ; une forme douteuse est ignorée", async () => {
    faux.repondre("rpc.fil_communaute", {
      data: {
        publications: [
          { ...BRUTE, piece_jointe: null, video: { plateforme: "vimeo", id: "76979871", url: "https://vimeo.com/76979871" } },
          { ...BRUTE, id: "b", piece_jointe: null, video: { plateforme: "youtube", id: "../x", url: "https://youtu.be/x" } },
        ],
        suite: false,
      },
    });
    const lecture = await lireFil("tous");
    expect(lecture.migrationAbsente ? [] : lecture.donnees.publications.map((p) => p.video)).toEqual([
      { plateforme: "vimeo", id: "76979871", url: "https://vimeo.com/76979871" },
      null,
    ]);
  });
});


describe("Le sondage d'une publication (0026)", () => {
  it("la conversion, et un lien temporaire pour chaque image d'option, dans le même appel que les pièces jointes", async () => {
    const { avecLiens, versPublication } = await import("@/lib/communaute/data");
    const p = versPublication({
      ...BRUTE,
      piece_jointe: null,
      programmee: true,
      sondage: {
        type: "images",
        choix_multiples: false,
        fin_le: null,
        ferme: false,
        a_repondu: true,
        votants: 2,
        options: [{ id: "o1", texte: "Rouge", image: { chemin: "c/r.png", nom: "r.png", type: "image/png", taille: 10 }, votes: 2, moi: true }],
      },
    });
    expect(p).toMatchObject({ programmee: true, sondage: { type: "images", aRepondu: true, votants: 2, options: [{ id: "o1", votes: 2, moi: true }] } });
    expect(p.sondage?.options[0]).not.toHaveProperty("correcte");
    faux.repondre("storage.communaute.createSignedUrls", { data: [{ path: "c/r.png", signedUrl: "https://stockage/r.png?jeton", error: null }] });
    const [lue] = await avecLiens(faux.client as never, [p]);
    expect(lue.sondage?.options[0].image?.url).toBe("https://stockage/r.png?jeton");
  });
});
