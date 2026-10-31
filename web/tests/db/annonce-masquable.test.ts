import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0039 (liste du 31 octobre 2026, tâche 6) : l'annonce de l'Accueil masquable. L'équipe choisit si les membres
// peuvent la masquer ; masquée, elle ne revient pour ce membre que si l'équipe la modifie (une nouvelle annonce).

let banc: Banc;
const S = randomUUID(); // super admin
const E = randomUUID();
const X = randomUUID();

type Annonce = { titre: string; masquable: boolean } | null;
const annonce = async (qui: string) => (await banc.en<{ a: Annonce }>({ id: qui }, "select public.annonce_communaute() as a"))[0].a;
const enregistrer = (masquable: boolean | null, titre = "Bienvenue") =>
  masquable === null
    ? banc.en({ id: S }, "select public.enregistrer_annonce(true, $1, '', null, null, null, 'tous', null)", [titre])
    : banc.en({ id: S }, "select public.enregistrer_annonce(true, $1, '', null, null, null, 'tous', null, $2)", [titre, masquable]);
const masquer = (qui: string) => banc.en({ id: qui }, "select public.masquer_annonce()");

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie", "0036_formateur_sans_espace_etudiant", "0037_reponses_aux_reponses", "0038_photos_communaute", "0039_annonce_masquable",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [E, []], [X, []]] as const) await banc.creerCompte(id, [...roles]);
});

describe("L'annonce masquable", () => {
  it("non masquable (par défaut) : personne ne peut la masquer", async () => {
    await enregistrer(null);
    expect(await annonce(E)).toMatchObject({ titre: "Bienvenue", masquable: false });
    await expect(masquer(E)).rejects.toThrow("Cette annonce ne peut pas être masquée.");
    expect(await annonce(E)).not.toBeNull();
  });

  it("masquable : un membre la masque pour lui seul ; l'équipe la modifie : elle revient", async () => {
    await enregistrer(true);
    expect(await annonce(E)).toMatchObject({ masquable: true });
    await masquer(E);
    expect(await annonce(E)).toBeNull();
    expect(await annonce(X)).not.toBeNull();
    // Réglage complet pour l'équipe : la case est relue.
    expect((await banc.en<{ a: { masquable: boolean } }>({ id: S }, "select public.annonce_equipe() as a"))[0].a.masquable).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    await enregistrer(true, "Nouvelle annonce");
    expect(await annonce(E)).toMatchObject({ titre: "Nouvelle annonce" });
  });
});
