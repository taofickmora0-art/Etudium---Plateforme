import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0016 : centre de notifications (spec 2026-10-14-notifications). Seule la base écrit les notifications
// (notifier) ; elle respecte les préférences du profil et n'avertit jamais l'auteur de l'action.
const MIGRATION = "supabase/migrations/0016_notifications.sql";
const REFUS = /row-level security|permission denied/;

let banc: Banc;
const E1 = randomUUID();
const E2 = randomUUID();
const E3 = randomUUID();
const A = randomUUID(); // admin
const S = randomUUID(); // super admin

type Ligne = { id: number; categorie: string; titre: string; texte: string; lien: string | null; cree_le: string; lue: boolean };
type Lot = { lignes: Ligne[]; suite: boolean; non_lues: number };
type Recue = { categorie: string; titre: string; texte: string; lien: string | null };

const listeSql = (ids: string[]) => `{${ids.join(",")}}`;

/** notifier, appelé par la base pendant une action de ce compte (null : sans compte, comme l'éditeur SQL). */
async function notifierEn(auteur: string | null, destinataires: string[], categorie: string, titre: string, texte = "", lien: string | null = null) {
  return banc.db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [auteur ?? ""]);
    const { rows } = await tx.query<{ n: number }>("select public.notifier($1::uuid[], $2, $3, $4, $5) as n", [listeSql(destinataires), categorie, titre, texte, lien]);
    return rows[0].n;
  });
}
const recues = async (compte: string) =>
  (await banc.db.query<Recue>("select categorie, titre, texte, lien from public.notifications where destinataire = $1 order by id", [compte])).rows;
const mes = async (compte: string, nonLues = false, avant: number | null = null, nombre = 20) =>
  (await banc.en<{ r: Lot }>({ id: compte }, "select public.mes_notifications($1, $2, $3) as r", [nonLues, avant, nombre]))[0].r;
const preferences = (compte: string, valeurs: Record<string, boolean>) =>
  banc.db.query("update public.profils set preferences_notifications = preferences_notifications || $2::jsonb where id = $1", [compte, JSON.stringify(valeurs)]);

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    "supabase/migrations/0004_contenus.sql",
    "supabase/migrations/0005_back_office.sql",
    "supabase/migrations/0006_notes.sql",
    "supabase/migrations/0007_visionnage.sql",
    "supabase/migrations/0008_progression.sql",
    "supabase/migrations/0009_favoris.sql",
    "supabase/migrations/0010_avis.sql",
    "supabase/migrations/0011_statistiques.sql",
    "supabase/exemples/lot-1.sql",
    "supabase/migrations/0012_couvertures.sql",
    "supabase/migrations/0013_utilisateurs.sql",
    "supabase/migrations/0014_espace_formateur.sql",
    "supabase/migrations/0015_suivi_etudiants.sql",
    MIGRATION,
  ]);
  for (const [id, roles] of [[E1, []], [E2, []], [E3, []], [A, ["admin"]], [S, ["super_admin"]]] as const) await banc.creerCompte(id, [...roles]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
  await banc.db.query("update public.profils set preferences_notifications = default");
});

describe("La table et notifier", () => {
  it("notifier : une ligne par destinataire, jamais l'auteur de l'action ; rend le nombre", async () => {
    expect(await notifierEn(E1, [E1, E2, E2, randomUUID()], "annonces", "Nouveautés", "Le texte.", "/accueil")).toBe(1);
    expect(await recues(E2)).toEqual([{ categorie: "annonces", titre: "Nouveautés", texte: "Le texte.", lien: "/accueil" }]);
    expect(await recues(E1)).toEqual([]);
    // Sans compte (éditeur SQL) : personne n'est écarté.
    expect(await notifierEn(null, [E1], "service", "Bienvenue")).toBe(1);
  });

  it("préférences : catégorie coupée → rien ; service passe ; canal dans l'appli coupé → rien, service compris", async () => {
    await preferences(E1, { annonces: false });
    expect(await notifierEn(null, [E1], "annonces", "Annonce")).toBe(0);
    expect(await notifierEn(null, [E1], "nouveaux_contenus", "Nouvelle formation")).toBe(1);
    expect(await notifierEn(null, [E1], "service", "Votre compte est réactivé")).toBe(1);
    await preferences(E2, { canal_appli: false });
    expect(await notifierEn(null, [E2], "annonces", "Annonce")).toBe(0);
    expect(await notifierEn(null, [E2], "service", "Votre compte est réactivé")).toBe(0);
    expect(await recues(E2)).toEqual([]);
  });

  it("une clé absente des préférences vaut activée", async () => {
    await banc.db.query("update public.profils set preferences_notifications = '{}'::jsonb where id = $1", [E1]);
    expect(await notifierEn(null, [E1], "nouveaux_contenus", "Nouvelle leçon")).toBe(1);
    expect(await notifierEn(null, [E1], "service", "Service")).toBe(1);
  });

  it("titre et texte coupés à 200 et 400 caractères", async () => {
    await notifierEn(null, [E1], "annonces", "t".repeat(250), "x".repeat(500));
    const [n] = await recues(E1);
    expect([n.titre.length, n.texte.length]).toEqual([200, 400]);
  });

  it("une catégorie inconnue ou un lien hors du site sont refusés", async () => {
    await expect(notifierEn(null, [E1], "inconnue", "Titre")).rejects.toThrow(/notifications_categorie/);
    await expect(notifierEn(null, [E1], "annonces", "Titre", "", "//site.com")).rejects.toThrow(/notifications_lien/);
    await expect(notifierEn(null, [E1], "annonces", "Titre", "", "https://site.com")).rejects.toThrow(/notifications_lien/);
  });
});

describe("Lecture par les comptes", () => {
  it("mes_notifications : les siennes, plus récentes d'abord ; non lues seulement ; non_lues ; suite", async () => {
    for (const titre of ["N1", "N2", "N3"]) await notifierEn(null, [E1], "annonces", titre, "Texte", "/accueil");
    await notifierEn(null, [E2], "annonces", "Pour E2");
    await banc.db.query("update public.notifications set lue_le = now() where titre = 'N1'");

    const tout = await mes(E1);
    expect(tout.lignes.map((l) => [l.titre, l.lue])).toEqual([["N3", false], ["N2", false], ["N1", true]]);
    expect(Object.keys(tout.lignes[0]).sort()).toEqual(["categorie", "cree_le", "id", "lien", "lue", "texte", "titre"]);
    expect(tout.lignes[0]).toMatchObject({ categorie: "annonces", texte: "Texte", lien: "/accueil" });
    expect([tout.suite, tout.non_lues]).toEqual([false, 2]);

    expect((await mes(E1, true)).lignes.map((l) => l.titre)).toEqual(["N3", "N2"]);
    const deux = await mes(E1, false, null, 2);
    expect([deux.lignes.length, deux.suite, deux.non_lues]).toEqual([2, true, 2]);
    // Nombre borné entre 1 et 50.
    expect((await mes(E1, false, null, 0)).lignes).toHaveLength(1);
  });

  it("Voir plus : 25 notifications de la même seconde, lues par 20 puis à partir de la dernière : 25 distinctes", async () => {
    await banc.db.query("select public.notifier(array[$1]::uuid[], 'nouveaux_contenus', 'N' || g, '', null) from generate_series(1, 25) g", [E1]);
    const premiere = await mes(E1, false, null, 20);
    expect([premiere.lignes.length, premiere.suite]).toEqual([20, true]);
    const seconde = await mes(E1, false, premiere.lignes[19].id, 20);
    expect([seconde.lignes.length, seconde.suite]).toEqual([5, false]);
    const titres = [...premiere.lignes, ...seconde.lignes].map((l) => l.titre);
    expect(new Set(titres).size).toBe(25);
    expect(titres[0]).toBe("N25");
    expect(titres[24]).toBe("N1");
  });

  it("marquer_lues : null marque toutes les siennes ; une liste ne touche jamais celles d'un autre", async () => {
    await notifierEn(null, [E1], "annonces", "A1");
    await notifierEn(null, [E1], "annonces", "A2");
    await notifierEn(null, [E2], "annonces", "B1");
    const idDe = async (titre: string) => (await banc.db.query<{ id: number }>("select id from public.notifications where titre = $1", [titre])).rows[0].id;

    await banc.en({ id: E1 }, "select public.marquer_lues($1::bigint[])", [`{${await idDe("B1")}}`]);
    expect((await mes(E2)).non_lues).toBe(1);
    await banc.en({ id: E1 }, "select public.marquer_lues($1::bigint[])", [`{${await idDe("A1")}}`]);
    expect((await mes(E1)).lignes.map((l) => [l.titre, l.lue])).toEqual([["A2", false], ["A1", true]]);
    await banc.en({ id: E1 }, "select public.marquer_lues(null)");
    expect((await mes(E1)).non_lues).toBe(0);
    expect((await mes(E2)).non_lues).toBe(1);
  });

  it("aucune écriture directe : insert refusé ; update d'une autre colonne que lue_le refusé ; notifier refusé à un compte", async () => {
    await notifierEn(null, [E2], "annonces", "Pour E2");
    await expect(banc.en({ id: E1 }, "insert into public.notifications (destinataire, categorie, titre) values ($1, 'annonces', 'x')", [E1])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E2 }, "update public.notifications set titre = 'x'")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E2 }, "delete from public.notifications")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: A }, "select public.notifier(array[$1]::uuid[], 'annonces', 'x', '', null)", [E1])).rejects.toThrow(REFUS);
    await expect(banc.en("anon", "select * from public.notifications")).rejects.toThrow(REFUS);
    // Celles d'un autre : ni lues, ni marquées.
    expect(await banc.en({ id: E1 }, "select * from public.notifications")).toEqual([]);
    await banc.en({ id: E1 }, "update public.notifications set lue_le = now()");
    expect((await mes(E2)).non_lues).toBe(1);
  });

  it("un compte suspendu ne lit rien", async () => {
    await notifierEn(null, [E3], "annonces", "Pour E3");
    await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [E3]);
    try {
      expect(await mes(E3)).toEqual({ lignes: [], suite: false, non_lues: 0 });
      expect(await banc.en({ id: E3 }, "select * from public.notifications")).toEqual([]);
    } finally {
      await banc.db.query("delete from public.suspensions where profil_id = $1", [E3]);
    }
  });

  it("plus de 6 mois : effacées au prochain envoi au même destinataire", async () => {
    await notifierEn(null, [E1], "annonces", "Vieille");
    await banc.db.query("update public.notifications set cree_le = now() - interval '7 months'");
    await notifierEn(null, [E2], "annonces", "Pour E2");
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Vieille"]);
    await notifierEn(null, [E1], "annonces", "Récente");
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Récente"]);
  });

  it("la migration est rejouable", async () => {
    await notifierEn(null, [E1], "annonces", "Gardée");
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Gardée"]);
  });
});
