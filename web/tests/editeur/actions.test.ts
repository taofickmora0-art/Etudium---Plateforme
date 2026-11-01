import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import type { SaisieInfos, SaisieLecon } from "@/lib/editeur/types";

// Les actions de l'éditeur (fin du lot 4, spec §2) : la saisie vérifiée avant de partir (mêmes messages qu'au clic),
// la réponse de la base traduite (enregistré, conflit, refus, migration absente) ; publier et abandonner rafraîchissent.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { enregistrerLecon, enregistrerInfosFormation, enregistrerQuestions, reglerLecon, publierModifications, abandonnerModifications, lireModificationsEnAttente } = await import(
  "@/lib/editeur/actions"
);

const L = "33333333-3333-4333-8333-333333333333";
const F = "44444444-4444-4444-8444-444444444444";
const doc = (texte: string) => ({ type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: texte }] }] });
const SAISIE: SaisieLecon = {
  titre: " Les tableaux croisés ",
  titreCourt: "",
  resume: "Résumé",
  pointsCles: [" Créer ", "", "Modifier"],
  lienVideo: "https://youtu.be/dQw4w9WgXcQ?si=x",
  duree: "12:40",
  document: doc("Bonjour"),
};
const INFOS: SaisieInfos = { titre: "Excel", resume: "Court", description: "Long", objectifs: ["Calculer", " "], competences: [], niveau: "debutant" };

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockReset();
  getShellUser.mockResolvedValue({ roles: ["formateur"] });
});

describe("Enregistrer une leçon", () => {
  it("le RPC reçoit les données normalisées : vidéo en fournisseur + identifiant, durée en secondes, texte brut ; pas de rafraîchissement", async () => {
    faux.repondre("rpc.enregistrer_lecon", { data: { etat: "enregistre", revision: 4, brouillon: true, enregistre_le: "2026-11-01T14:32:00Z" } });
    expect(await enregistrerLecon(L, SAISIE, 3)).toEqual({ ok: true, revision: 4, brouillon: true, enregistreLe: "2026-11-01T14:32:00Z" });
    expect(faux.de("rpc", "enregistrer_lecon")[0].valeurs).toEqual({
      p_lecon: L,
      p_revision: 3,
      p_donnees: {
        titre: "Les tableaux croisés",
        titre_court: null,
        resume: "Résumé",
        points_cles: ["Créer", "Modifier"],
        video_fournisseur: "youtube",
        video_id: "dQw4w9WgXcQ",
        duree_secondes: 760,
        document: doc("Bonjour"),
        texte: "Bonjour",
      },
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("invalide : lien non reconnu, durée manquante pour YouTube, titre vide, document refusé ; rien ne part", async () => {
    const r = await enregistrerLecon(L, { ...SAISIE, titre: " ", lienVideo: "https://exemple.com/v.mp4", duree: "0:00" }, 3);
    expect(r).toMatchObject({ ok: false, code: "invalide", erreurs: { titre: "Entrez le titre de la leçon.", video: expect.stringContaining("Ce lien n’est pas une vidéo") } });
    expect(await enregistrerLecon(L, { ...SAISIE, duree: "0:00" }, 3)).toMatchObject({ code: "invalide", erreurs: { duree: "Saisissez la durée de la vidéo : elle sert à mesurer le temps regardé." } });
    const lien = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link" as const, attrs: { href: "javascript:x" } }] }] }] };
    expect(await enregistrerLecon(L, { ...SAISIE, document: lien }, 3)).toMatchObject({ code: "invalide", erreurs: { texte: "Un lien doit commencer par http:// ou https://." } });
    expect(faux.appels).toEqual([]);
  });

  it("Review Focus 4 : un texte de 20 001 caractères → invalide avec le message des limites", async () => {
    expect(await enregistrerLecon(L, { ...SAISIE, document: doc("a".repeat(20_001)) }, 3)).toMatchObject({
      code: "invalide",
      erreurs: { texte: "Le texte dépasse 20 000 caractères." },
    });
  });

  it("un conflit est rendu tel quel", async () => {
    faux.repondre("rpc.enregistrer_lecon", { data: { etat: "conflit", par: "Aïcha Kpadé" } });
    expect(await enregistrerLecon(L, SAISIE, 3)).toEqual({ ok: false, code: "conflit", par: "Aïcha Kpadé" });
  });

  it("un refus de la base (règle ou droits) se montre ; une migration absente le dit ; une panne se réessaie", async () => {
    faux.repondre("rpc.enregistrer_lecon", { error: { code: "42501", message: "Vous ne pouvez pas modifier cette leçon." } });
    expect(await enregistrerLecon(L, SAISIE, 3)).toEqual({ ok: false, code: "invalide", erreurs: { formulaire: "Vous ne pouvez pas modifier cette leçon." } });
    faux.repondre("rpc.enregistrer_lecon", { error: { code: "PGRST202", message: "absent" } });
    expect(await enregistrerLecon(L, SAISIE, 3)).toMatchObject({ ok: false, code: "echec", message: expect.stringContaining("migration 0056") });
    faux.repondre("rpc.enregistrer_lecon", { error: { code: "08006", message: "connexion" } });
    expect(await enregistrerLecon(L, SAISIE, 3)).toMatchObject({ ok: false, code: "echec" });
  });

  it("un compte sans droit d'édition ne part pas en base", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await enregistrerLecon(L, SAISIE, 3)).toMatchObject({ ok: false, code: "invalide" });
    expect(faux.appels).toEqual([]);
  });
});

describe("Les informations générales, les réglages, la publication", () => {
  it("informations : normalisées puis envoyées", async () => {
    faux.repondre("rpc.enregistrer_infos_formation", { data: { etat: "enregistre", revision: 1, brouillon: false, enregistre_le: "2026-11-01T14:32:00Z" } });
    expect(await enregistrerInfosFormation(F, INFOS, 0)).toMatchObject({ ok: true, brouillon: false });
    expect(faux.de("rpc", "enregistrer_infos_formation")[0].valeurs).toEqual({
      p_formation: F,
      p_revision: 0,
      p_donnees: { titre: "Excel", resume: "Court", description: "Long", objectifs: ["Calculer"], competences: [], niveau: "debutant" },
    });
    expect(await enregistrerInfosFormation(F, { ...INFOS, titre: "" }, 0)).toMatchObject({ code: "invalide", erreurs: { titre: "Entrez le titre de la formation." } });
  });

  it("les questions d'un quiz partent à la base ; un refus donne son message ; avant la 0031, le message de la migration", async () => {
    const QUESTIONS = [{ id: "q", genre: "vrai_faux", enonce: "Vrai ?", choix: [], reponses: [], explication: "" }];
    expect(await enregistrerQuestions(L, QUESTIONS)).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_quiz")[0].valeurs).toEqual({ p_lecon: L, p_questions: QUESTIONS });
    faux.repondre("rpc.enregistrer_quiz", { error: { code: "P0001", message: "La question 1 doit avoir une seule bonne réponse." } });
    expect(await enregistrerQuestions(L, QUESTIONS)).toEqual({ ok: false, message: "La question 1 doit avoir une seule bonne réponse." });
    faux.repondre("rpc.enregistrer_quiz", { error: { code: "PGRST202", message: "absente" } });
    expect(await enregistrerQuestions(L, QUESTIONS)).toEqual({ ok: false, message: "Appliquez la migration 0031 (guide « Ce qui te revient », section 37)." });
  });

  it("réglages d'une leçon : enregistrés aussitôt", async () => {
    expect(await reglerLecon(L, { commentairesActifs: false, apercu: true, genreExercice: "simple" })).toEqual({ ok: true });
    expect(faux.de("lecons", "update")[0].valeurs).toEqual({ commentaires_actifs: false, apercu: true, genre_exercice: "simple" });
  });

  it("publier et abandonner rafraîchissent ; la liste en attente", async () => {
    faux.repondre("rpc.publier_modifications", { data: { publiees: 2, version: 8 } });
    expect(await publierModifications(F)).toEqual({ ok: true, publiees: 2, version: 8 });
    expect(await abandonnerModifications(F, L)).toEqual({ ok: true });
    expect(faux.de("rpc", "abandonner_modifications")[0].valeurs).toEqual({ p_formation: F, p_lecon: L });
    expect(refresh).toHaveBeenCalledTimes(2);
    faux.repondre("rpc.modifications_en_attente", {
      data: [{ type: "lecon", id: L, titre: "Les tableaux", rang: 3, modifie_par: "Aïcha Kpadé", modifie_le: "2026-11-01T14:32:00Z" }],
    });
    expect(await lireModificationsEnAttente(F)).toEqual({
      migrationAbsente: false,
      donnees: [{ type: "lecon", id: L, titre: "Les tableaux", rang: 3, modifiePar: "Aïcha Kpadé", modifieLe: "2026-11-01T14:32:00Z" }],
    });
    faux.repondre("rpc.publier_modifications", { error: { code: "P0001", message: "Cette formation n'est pas encore en ligne : envoyez-la en relecture." } });
    expect(await publierModifications(F)).toEqual({ ok: false, message: "Cette formation n’est pas encore en ligne : envoyez-la en relecture." });
  });
});
