import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as icones from "@hugeicons/core-free-icons";
import { fauxSupabase } from "../admin/faux-supabase";

// Migration 0070 : le formateur public dans l'appli. La lecture de sa fiche (formateur_public), sa conversion, ses
// réseaux, et « Message » (ouvrir_conversation_formateur).
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
const demoModeActive = vi.fn(() => false);
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => demoModeActive() }));

const { lireFormateurDeFiche, lireFormateurPublic, MIGRATION_FORMATEURS } = await import("@/lib/formateurs/data");
const { versFormateurPublic } = await import("@/lib/formateurs/conversion");
const { RESEAUX, CLES_RESEAUX, reseauxRenseignes, versReseaux } = await import("@/lib/formateurs/reseaux");
const { ecrireAuFormateur } = await import("@/lib/formateurs/actions");
const { photoPublicUrl } = await import("@/lib/profile/photo-url");
const { arriveeDuFormateur, nombreDeFormations } = await import("@/lib/formateurs/regles");

const ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION = "22222222-2222-4222-8222-222222222222";
const PHOTO = "33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.jpg";
const EXCEL = {
  id: "f1",
  slug: "maitriser-excel",
  titre: "Maîtriser Excel",
  resume: "Les tableaux croisés.",
  couverture: "f1/55555555-5555-4555-8555-555555555555.webp",
  niveau: "intermediaire",
  gratuite: false,
  badge: "populaire",
  publiee_le: "2026-10-20T09:00:00+00:00",
  duree_secondes: 1800,
  nb_lecons: 3,
  nb_modules: 2,
  note_moyenne: 4.5,
  nb_avis: 12,
  parcours: [
    { slug: "competences", nom: "Compétences digitales", nom_court: "Compétences", couleur: "digital", ordre: 1, position: 4 },
    { slug: "academique", nom: "Réussite académique", nom_court: "Académique", couleur: "academique", ordre: 2, position: 0 },
  ],
};
const BRUT = {
  id: ID,
  nom: "Koffi Mensah",
  titre: "Expert Excel",
  domaine: "Bureautique",
  presentation: "Dix ans de formation.",
  reseaux: { instagram: "https://instagram.com/koffi", tiktok: "https://tiktok.com/@koffi" },
  photo: PHOTO,
  rejoint_le: "2026-09-01T10:00:00+00:00",
  formations: [EXCEL],
  nb_formations: 1,
  peut_ecrire: true,
};
const CARTE_EXCEL = {
  id: "f1",
  slug: "maitriser-excel",
  titre: "Maîtriser Excel",
  resume: "Les tableaux croisés.",
  niveau: "intermediaire",
  gratuite: false,
  badge: "populaire",
  publieeLe: "2026-10-20T09:00:00+00:00",
  dureeSecondes: 1800,
  nbLecons: 3,
  nbModules: 2,
  parcours: [
    { slug: "competences", nom: "Compétences digitales", nomCourt: "Compétences", couleur: "digital", ordre: 1, position: 4 },
    { slug: "academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique", ordre: 2, position: 0 },
  ],
  note: 4.5,
  nbAvis: 12,
  couverture: "f1/55555555-5555-4555-8555-555555555555.webp",
};
const ABSENTE = { error: { code: "PGRST202", message: "Could not find the function public.formateur_public" } };

beforeEach(() => {
  faux.vider();
  getShellUser.mockReset().mockResolvedValue({ id: "moi" });
  demoModeActive.mockReset().mockReturnValue(false);
  // L'adresse publique des photos de profil se calcule avec l'adresse du projet.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("Les réseaux", () => {
  it("six réseaux, dans l'ordre, avec leur libellé et une icône Hugeicons qui existe", () => {
    expect(CLES_RESEAUX).toEqual(["instagram", "youtube", "linkedin", "facebook", "telegram", "tiktok"]);
    expect(RESEAUX.map((r) => [r.cle, r.libelle])).toEqual([
      ["instagram", "Instagram"],
      ["youtube", "YouTube"],
      ["linkedin", "LinkedIn"],
      ["facebook", "Facebook"],
      ["telegram", "Telegram"],
      ["tiktok", "TikTok"],
    ]);
    const connues = new Set(Object.values(icones));
    for (const r of RESEAUX) expect(connues.has(r.icone)).toBe(true);
  });

  it("versReseaux garde les réseaux permis en https:// ; reseauxRenseignes les range dans l'ordre de la liste", () => {
    const brut = {
      tiktok: "https://tiktok.com/@koffi",
      twitter: "https://x.com/koffi",
      instagram: "https://instagram.com/koffi",
      youtube: "http://youtube.com/@koffi",
      facebook: 3,
      telegram: "",
    };
    expect(versReseaux(brut)).toEqual({ tiktok: "https://tiktok.com/@koffi", instagram: "https://instagram.com/koffi" });
    expect(versReseaux(null)).toEqual({});
    expect(versReseaux(["https://instagram.com/koffi"])).toEqual({});
    expect(reseauxRenseignes(versReseaux(brut)).map((r) => [r.cle, r.libelle, r.url])).toEqual([
      ["instagram", "Instagram", "https://instagram.com/koffi"],
      ["tiktok", "TikTok", "https://tiktok.com/@koffi"],
    ]);
  });
});

describe("versFormateurPublic", () => {
  it("convertit la fiche : photo en adresse publique, formations en cartes du catalogue (avec leurs modules)", () => {
    expect(versFormateurPublic(BRUT)).toEqual({
      id: ID,
      nom: "Koffi Mensah",
      titre: "Expert Excel",
      domaine: "Bureautique",
      presentation: "Dix ans de formation.",
      reseaux: { instagram: "https://instagram.com/koffi", tiktok: "https://tiktok.com/@koffi" },
      photoUrl: photoPublicUrl(PHOTO),
      rejointLe: "2026-09-01T10:00:00+00:00",
      formations: [CARTE_EXCEL],
      nbFormations: 1,
      peutEcrire: true,
    });
    expect(photoPublicUrl(PHOTO)).toMatch(/^https:\/\/projet\.supabase\.co\/storage\/v1\/object\/public\/photos-profil\//);
  });

  it("des valeurs manquantes ou inattendues prennent une valeur sûre", () => {
    const formation = { ...EXCEL, niveau: "expert", badge: "promo", note_moyenne: null, couverture: null, parcours: [{ nom_court: "?", couleur: "rose", ordre: 1 }], nb_lecons: "x" };
    const fiche = versFormateurPublic({ id: ID, nom: "Koffi", photo: "https://ailleurs.com/image.jpg", reseaux: "non", formations: [formation], peut_ecrire: "oui" });
    // Sans nombre de formations : celui de la liste.
    expect(fiche).toMatchObject({ titre: "", domaine: "", presentation: "", reseaux: {}, photoUrl: null, rejointLe: "", nbFormations: 1, peutEcrire: false });
    expect(fiche?.formations[0]).toMatchObject({ niveau: "debutant", badge: null, note: null, couverture: null, parcours: [], nbLecons: 0 });
  });

  it("rien d'exploitable : null", () => {
    expect(versFormateurPublic(null)).toBeNull();
    expect(versFormateurPublic("fiche")).toBeNull();
    expect(versFormateurPublic({ nom: "Sans identifiant" })).toBeNull();
  });
});

describe("lireFormateurPublic", () => {
  it("lit la fiche par la base et la convertit", async () => {
    faux.repondre("rpc.formateur_public", { data: BRUT });
    expect(await lireFormateurPublic(ID)).toEqual(versFormateurPublic(BRUT));
    expect(faux.de("rpc", "formateur_public")[0].valeurs).toEqual({ p_formateur: ID });
  });

  it("une fiche inconnue, une adresse qui n'est pas un identifiant, le mode démonstration : null", async () => {
    faux.repondre("rpc.formateur_public", { data: null });
    expect(await lireFormateurPublic(ID)).toBeNull();
    faux.vider();
    expect(await lireFormateurPublic("koffi-mensah")).toBeNull();
    demoModeActive.mockReturnValue(true);
    expect(await lireFormateurPublic(ID)).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("sans la migration 0070 : « absente » ; une autre erreur est levée", async () => {
    faux.repondre("rpc.formateur_public", ABSENTE);
    expect(await lireFormateurPublic(ID)).toBe("absente");
    faux.repondre("rpc.formateur_public", { error: { code: "42883", message: "function public.formateur_public(uuid) does not exist" } });
    expect(await lireFormateurPublic(ID)).toBe("absente");
    faux.repondre("rpc.formateur_public", { error: { code: "57014", message: "timeout" } });
    await expect(lireFormateurPublic(ID)).rejects.toThrow(/formateur/);
    expect(MIGRATION_FORMATEURS).toMatch(/0070/);
  });
});

describe("Règles d'affichage du formateur", () => {
  it("« N formations » s'accorde ; « A rejoint : il y a … » suit le temps relatif de la communauté, rien sans date", () => {
    expect([0, 1, 3].map(nombreDeFormations)).toEqual(["0 formation", "1 formation", "3 formations"]);
    const maintenant = new Date("2026-11-02T12:00:00+01:00");
    expect(arriveeDuFormateur("2026-10-30T12:00:00+01:00", maintenant)).toBe("A rejoint : il y a 3 jours");
    expect(arriveeDuFormateur("2026-11-01T12:00:00+01:00", maintenant)).toBe("A rejoint : hier");
    expect(arriveeDuFormateur("", maintenant)).toBe("");
    expect(arriveeDuFormateur("pas une date", maintenant)).toBe("");
  });
});

describe("lireFormateurDeFiche (le bloc « Formateur du cours » de la fiche)", () => {
  it("le formateur de la formation, sans la liste de ses formations (leur nombre suffit)", async () => {
    faux.repondre("rpc.formateur_public", { data: { ...BRUT, nb_formations: 3 } });
    expect(await lireFormateurDeFiche(ID)).toEqual({
      id: ID,
      nom: "Koffi Mensah",
      titre: "Expert Excel",
      domaine: "Bureautique",
      presentation: "Dix ans de formation.",
      reseaux: { instagram: "https://instagram.com/koffi", tiktok: "https://tiktok.com/@koffi" },
      photoUrl: photoPublicUrl(PHOTO),
      rejointLe: "2026-09-01T10:00:00+00:00",
      nbFormations: 3,
      peutEcrire: true,
    });
  });

  it("formation sans formateur, fiche inconnue, migration 0070 absente ou lecture en échec : null (la fiche garde le bloc d'avant)", async () => {
    expect(await lireFormateurDeFiche(undefined)).toBeNull();
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.formateur_public", { data: null });
    expect(await lireFormateurDeFiche(ID)).toBeNull();
    faux.repondre("rpc.formateur_public", ABSENTE);
    expect(await lireFormateurDeFiche(ID)).toBeNull();
    const trace = vi.spyOn(console, "error").mockImplementation(() => {});
    faux.repondre("rpc.formateur_public", { error: { code: "57014", message: "timeout" } });
    expect(await lireFormateurDeFiche(ID)).toBeNull();
    expect(trace).toHaveBeenCalled();
    trace.mockRestore();
  });
});

describe("ecrireAuFormateur", () => {
  it("ouvre (ou retrouve) la conversation avec le formateur et rend son identifiant", async () => {
    faux.repondre("rpc.ouvrir_conversation_formateur", { data: CONVERSATION });
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: true, conversationId: CONVERSATION });
    expect(faux.de("rpc", "ouvrir_conversation_formateur")[0].valeurs).toEqual({ p_formateur: ID });
  });

  it("le refus de la base est rendu tel quel, en français", async () => {
    faux.repondre("rpc.ouvrir_conversation_formateur", { error: { code: "42501", message: "Inscrivez-vous à une de ses formations pour lui écrire." } });
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: false, message: "Inscrivez-vous à une de ses formations pour lui écrire." });
    faux.repondre("rpc.ouvrir_conversation_formateur", { error: { code: "P0001", message: "Ce formateur est introuvable." } });
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: false, message: "Ce formateur est introuvable." });
  });

  it("sans la migration, sur une autre erreur ou une réponse inattendue : un message clair", async () => {
    faux.repondre("rpc.ouvrir_conversation_formateur", ABSENTE);
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: false, message: MIGRATION_FORMATEURS });
    faux.repondre("rpc.ouvrir_conversation_formateur", { error: { code: "57014", message: "canceling statement due to statement timeout" } });
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: false, message: "La conversation n’a pas pu s’ouvrir. Réessayez." });
    faux.repondre("rpc.ouvrir_conversation_formateur", { data: null });
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: false, message: "La conversation n’a pas pu s’ouvrir. Réessayez." });
  });

  it("session expirée ou identifiant invalide : rien n'est demandé à la base", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await ecrireAuFormateur(ID)).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
    getShellUser.mockResolvedValue({ id: "moi" });
    expect(await ecrireAuFormateur("pas-un-id")).toEqual({ ok: false, message: "La conversation n’a pas pu s’ouvrir. Réessayez." });
    expect(faux.appels).toEqual([]);
  });
});
