import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lot 5, étape A : la logique de la messagerie dans l'appli (lectures, envoi, assistance, pièces jointes, pastille).
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { lireConversations, lireFil, lireContacts, MIGRATION_MESSAGES } = await import("@/lib/messages/data");
const { envoyerMessage, ouvrirConversation, contacterEquipe, compterMessagesNonLus, lienFichierMessage, relireFil, chercherContacts } = await import(
  "@/lib/messages/actions"
);
const { MESSAGE_MAX_OCTETS, formatDeMessage, LIBELLE_FORMATS_MESSAGE } = await import("@/lib/messages/fichiers");
const { SUJETS_ASSISTANCE } = await import("@/lib/messages/types");
const { photoPublicUrl } = await import("@/lib/profile/photo-url");

const C = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";
const ABSENTE = { error: { code: "PGRST202", message: "Could not find the function" } };
const PHOTO = "33333333-3333-4333-8333-333333333333/photo.jpg";
const RESUME = {
  id: C,
  avec: { nom: "Dr Mireille Adjovi", photo: PHOTO, role: "Formateur·rice", equipe: false },
  formation: { titre: "Maîtriser Microsoft Excel", slug: "excel" },
  dernier: { texte: "Merci !", fichier: null, de_moi: true, cree_le: "2026-10-15T14:05:00Z" },
  non_lu: false,
};
const MESSAGE = { id: M, texte: "Bonjour", fichier: { nom: "Tableau.xlsx", format: "application/zip", taille: 248000 }, de_moi: false, auteur: null, cree_le: "2026-10-15T14:02:00Z" };

beforeEach(() => {
  faux.vider();
  getShellUser.mockReset().mockResolvedValue({ id: "moi" });
  // L'adresse publique des photos de profil se calcule avec l'adresse du projet.
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});
afterEach(() => vi.unstubAllEnvs());

describe("Lire", () => {
  it("les conversations, converties ; avant la 0035 : la migration manque", async () => {
    faux.repondre("rpc.mes_conversations", { data: [RESUME, { ...RESUME, id: "c2", avec: { nom: "Équipe Étudium", photo: null, role: "Assistance", equipe: true }, formation: null, dernier: null, non_lu: true }] });
    const lecture = await lireConversations("etudiant");
    expect(faux.de("rpc")[0].valeurs).toEqual({ p_espace: "etudiant" });
    expect(lecture).toEqual({
      migrationAbsente: false,
      donnees: [
        {
          id: C,
          avec: { nom: "Dr Mireille Adjovi", photoUrl: photoPublicUrl(PHOTO), role: "Formateur·rice", equipe: false },
          formation: { titre: "Maîtriser Microsoft Excel", slug: "excel" },
          dernier: { texte: "Merci !", fichier: null, deMoi: true, creeLe: "2026-10-15T14:05:00Z" },
          nonLu: false,
        },
        { id: "c2", avec: { nom: "Équipe Étudium", photoUrl: null, role: "Assistance", equipe: true }, formation: null, dernier: null, nonLu: true },
      ],
    });
    faux.vider();
    faux.repondre("rpc.mes_conversations", ABSENTE);
    expect(await lireConversations("etudiant")).toEqual({ migrationAbsente: true });
    expect(MIGRATION_MESSAGES).toBe("Appliquez la migration 0035 (guide « Ce qui te revient », section 42).");
  });

  it("le fil d'une conversation ; une adresse inventée ne va pas jusqu'à la base", async () => {
    faux.repondre("rpc.fil_conversation", { data: { conversation: RESUME, messages: [MESSAGE], plus_anciens: true } });
    const lecture = await lireFil(C);
    expect(lecture).toMatchObject({
      migrationAbsente: false,
      donnees: { conversation: { id: C }, messages: [{ id: M, texte: "Bonjour", fichier: { nom: "Tableau.xlsx", taille: 248000 }, deMoi: false, auteur: null }], plusAnciens: true },
    });
    faux.vider();
    expect(await lireFil("pas-un-identifiant")).toEqual({ migrationAbsente: false, donnees: null });
    expect(faux.de("rpc")).toEqual([]);
  });

  it("les contacts : l'Équipe Étudium s'ajoute pour l'étudiant, pas pour le formateur", async () => {
    faux.repondre("rpc.contacts_messagerie", { data: [{ id: F, nom: "Dr Mireille Adjovi", photo: null, formation: "Excel" }] });
    expect(await lireContacts("etudiant")).toEqual({
      migrationAbsente: false,
      donnees: [
        { id: F, nom: "Dr Mireille Adjovi", photoUrl: null, formation: "Excel" },
        { id: null, nom: "Équipe Étudium", photoUrl: null, formation: null },
      ],
    });
    expect((await lireContacts("formateur")).migrationAbsente === false && (await lireContacts("formateur"))).toMatchObject({ donnees: [{ id: F }] });
    expect(await chercherContacts("formateur", "aïch")).toHaveLength(1);
    expect(faux.de("rpc", "contacts_messagerie").at(-1)?.valeurs).toEqual({ p_espace: "formateur", p_recherche: "aïch" });
  });
});

describe("Écrire", () => {
  it("envoyer : le texte, la pièce jointe ; le message revient converti", async () => {
    faux.repondre("rpc.envoyer_message", { data: { ...MESSAGE, de_moi: true } });
    const r = await envoyerMessage(C, "Bonjour", { chemin: "moi/x/Tableau.xlsx", nom: "Tableau.xlsx" });
    expect(faux.de("rpc", "envoyer_message")[0].valeurs).toEqual({ p_conversation: C, p_texte: "Bonjour", p_fichier: "moi/x/Tableau.xlsx", p_nom: "Tableau.xlsx" });
    expect(r).toMatchObject({ ok: true, message: { id: M, deMoi: true } });
  });

  it("les refus de la base s'affichent ; la session expirée aussi", async () => {
    faux.repondre("rpc.envoyer_message", { error: { code: "P0001", message: "Écrivez un message ou joignez un fichier." } });
    expect(await envoyerMessage(C, "", null)).toEqual({ ok: false, message: "Écrivez un message ou joignez un fichier." });
    faux.repondre("rpc.envoyer_message", { error: { code: "42501", message: "Votre compte est suspendu." } });
    expect(await envoyerMessage(C, "x", null)).toEqual({ ok: false, message: "Votre compte est suspendu." });
    faux.repondre("rpc.ouvrir_conversation", { error: { code: "42501", message: "Vous ne pouvez pas écrire à cette personne." } });
    expect(await ouvrirConversation(F)).toEqual({ ok: false, message: "Vous ne pouvez pas écrire à cette personne." });
    getShellUser.mockResolvedValue(null);
    expect(await envoyerMessage(C, "x", null)).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
  });

  it("contacter l'équipe : ouvre l'assistance et écrit « Sujet : … » puis le message", async () => {
    faux.repondre("rpc.ouvrir_conversation", { data: C });
    faux.repondre("rpc.envoyer_message", { data: MESSAGE });
    expect(await contacterEquipe("Certificat", "  Mon certificat ne s’affiche pas.  ")).toEqual({ ok: true });
    expect(faux.de("rpc", "ouvrir_conversation")[0].valeurs).toEqual({ p_avec: null });
    expect(faux.de("rpc", "envoyer_message")[0].valeurs).toMatchObject({ p_conversation: C, p_texte: "Sujet : Certificat\nMon certificat ne s’affiche pas." });
    expect(await contacterEquipe("Inventé", "x")).toEqual({ ok: false, message: "Choisissez un sujet." });
    expect(await contacterEquipe("Autre", "   ")).toEqual({ ok: false, message: "Écrivez votre message." });
    expect(SUJETS_ASSISTANCE).toEqual(["Paiement et abonnement", "Accès à une formation", "Certificat", "Problème technique", "Autre"]);
  });

  it("relire un fil : null sur une erreur (l'écran garde ce qu'il montre)", async () => {
    faux.repondre("rpc.fil_conversation", { error: { code: "XX000", message: "base injoignable" } });
    expect(await relireFil(C)).toBeNull();
  });
});

describe("Pastille et pièces jointes", () => {
  it("le nombre de conversations non lues ; 0 sans compte, sur une erreur ou avant la 0035", async () => {
    faux.repondre("rpc.messages_non_lus", { data: 3 });
    expect(await compterMessagesNonLus("etudiant")).toBe(3);
    faux.repondre("rpc.messages_non_lus", ABSENTE);
    expect(await compterMessagesNonLus("etudiant")).toBe(0);
    getShellUser.mockResolvedValue(null);
    expect(await compterMessagesNonLus("etudiant")).toBe(0);
  });

  it("le lien de téléchargement d'une pièce jointe, signé 60 s, avec son nom", async () => {
    faux.repondre("rpc.fichier_message", { data: { chemin: "f/x/Tableau ventes.xlsx", nom: "Tableau ventes.xlsx" } });
    faux.repondre("storage.messages.createSignedUrl", { data: { signedUrl: "https://s/x?token=t" } });
    expect(await lienFichierMessage(M)).toEqual({ url: "https://s/x?token=t&download=Tableau%20ventes.xlsx" });
    expect(faux.de("storage.messages", "createSignedUrl")[0].valeurs).toEqual(["f/x/Tableau ventes.xlsx", 60]);
    faux.repondre("rpc.fichier_message", { data: null });
    expect(await lienFichierMessage(M)).toEqual({ erreur: "Ce fichier n’est pas accessible." });
  });

  it("les formats des rendus, 10 Mo au plus", () => {
    expect(MESSAGE_MAX_OCTETS).toBe(10485760);
    expect(LIBELLE_FORMATS_MESSAGE).toBe("PDF, Word, Excel, PowerPoint, image ou ZIP · 10 Mo maximum");
    expect(formatDeMessage("notes.txt", new Uint8Array([0x68, 0x69]))).toBeNull();
    expect(formatDeMessage("doc.pdf", new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
  });
});
