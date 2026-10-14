import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0023 (spec Formations et Événements, §3.2) : rappel 10 min avant, annonce du début du live à tous les comptes,
// traitement global et sans doublon (tâche planifiée et cloche). La base en mémoire n'a pas pg_cron : la migration passe.
const REFUS = /permission denied/;

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur « Mireille Akpo »
const E1 = randomUUID(); // inscrit
const E2 = randomUUID(); // inscrit
const NI = randomUUID(); // non inscrit
const COUPE = randomUUID(); // a coupé « Sessions live »
let FA: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
type Recue = { titre: string; texte: string; lien: string | null };
const recues = async (compte: string) =>
  (await banc.db.query<Recue>("select titre, texte, lien from public.notifications where destinataire = $1 and categorie = 'sessions_live' order by id", [compte])).rows;
const traiter = async () => (await un<{ n: number }>("select public.traiter_sessions_live() as n")).n;

/** Une session posée directement, par rapport à now(). */
async function session(debutDans: string, o: { titre?: string; duree?: number; statut?: string } = {}) {
  return (
    await un<{ id: string }>(
      `insert into public.sessions_live (titre, debut, duree_minutes, lien, formateur_id, statut, cree_par)
       values ($1, now() + $2::interval, $3, 'https://meet.google.com/abc-defg-hij', $4, $5, $6) returning id`,
      [o.titre ?? "Session", debutDans, o.duree ?? 60, FA, o.statut ?? "programmee", F],
    )
  ).id;
}
const inscrire = (compte: string, id: string) => banc.db.query("insert into public.inscriptions_sessions (session_id, profil_id) values ($1, $2)", [id, compte]);

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
    "supabase/migrations/0016_notifications.sql",
    "supabase/migrations/0017_role_unique.sql",
    "supabase/migrations/0018_sessions_live.sql",
    "supabase/migrations/0023_sessions_rappels.sql",
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E1, []], [E2, []], [NI, []], [COUPE, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Akpo' where id = $1", [F]);
  await banc.db.query("update public.profils set preferences_notifications = preferences_notifications || '{\"sessions_live\": false}'::jsonb where id = $1", [COUPE]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
  await banc.db.query("delete from public.sessions_live");
});

describe("Rappel 10 min avant", () => {
  it("chaque inscrit le reçoit une seule fois ; le non-inscrit, non", async () => {
    const id = await session("8 minutes", { titre: "Excel avancé" });
    await inscrire(E1, id);
    await inscrire(E2, id);
    expect(await traiter()).toBe(2);
    expect(await traiter()).toBe(0);
    const [rappel] = await recues(E1);
    expect(rappel.titre).toBe("Session live dans 10 minutes");
    expect(rappel.texte).toMatch(/^Excel avancé, à \d{1,2} h \d{2}\. Le lien est ouvert : rejoignez la session depuis la page Événements\.$/);
    expect(rappel.lien).toBe("/evenements");
    expect(await recues(E2)).toHaveLength(1);
    expect(await recues(NI)).toEqual([]);
  });

  it("un rappel 10 min clôt ceux d'1 h et de la veille qui n'ont pas pu partir", async () => {
    const id = await session("5 minutes");
    await inscrire(E1, id);
    await traiter();
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Session live dans 10 minutes"]);
    const suivi = await un<{ h: string | null; v: string | null }>(
      "select rappel_heure_le as h, rappel_veille_le as v from public.inscriptions_sessions where session_id = $1 and profil_id = $2",
      [id, E1],
    );
    expect(suivi.h).not.toBeNull();
    expect(suivi.v).not.toBeNull();
  });

  it("1 h avant reste entre 10 min et 1 h ; la veille entre 1 h et 24 h", async () => {
    const heure = await session("40 minutes", { titre: "Heure" });
    const veille = await session("5 hours", { titre: "Veille" });
    await inscrire(E1, heure);
    await inscrire(E1, veille);
    expect(await traiter()).toBe(2);
    const titres = (await recues(E1)).map((n) => n.titre);
    expect(titres).toContain("Session live dans moins d’une heure");
    expect(titres.some((t) => t === "Session live aujourd’hui" || t === "Session live demain")).toBe(true);
  });

  it("s'inscrire à moins de 10 min du début : pas de rappel aussitôt", async () => {
    const id = await session("6 minutes");
    await banc.en({ id: E1 }, "select public.sinscrire_session($1)", [id]);
    expect(await traiter()).toBe(0);
    expect(await recues(E1)).toEqual([]);
  });
});

describe("Annonce du début du live", () => {
  it("à tous les comptes, équipe et non-inscrits compris, une seule fois ; préférences respectées", async () => {
    const id = await session("-1 minute", { titre: "Live Excel" });
    await inscrire(E1, id);
    const comptes = (await un<{ n: number }>("select count(*)::int as n from public.profils")).n;
    // Tout le monde sauf celui qui a coupé les notifications de sessions live.
    expect(await traiter()).toBe(comptes - 1);
    expect(await traiter()).toBe(0);
    for (const compte of [S, F, E1, NI]) {
      expect(await recues(compte)).toEqual([
        { titre: "C’est l’heure du live : Live Excel", texte: "La session vient de commencer avec Mireille Akpo. Rejoignez-la depuis la page Événements.", lien: "/evenements" },
      ]);
    }
    expect(await recues(COUPE)).toEqual([]);
  });

  it("jamais pour une session annulée, terminée, ou pas encore commencée", async () => {
    await session("-1 minute", { statut: "annulee" });
    await session("-2 hours", { duree: 60 });
    await session("30 minutes");
    expect(await traiter()).toBe(0);
    expect(await recues(NI)).toEqual([]);
  });

  it("une session déplacée : son annonce et ses rappels repartent de zéro", async () => {
    const id = await session("-1 minute", { titre: "Déplacée" });
    await inscrire(E1, id);
    const comptes = (await un<{ n: number }>("select count(*)::int as n from public.profils")).n;
    expect(await traiter()).toBe(comptes - 1);
    // Reportée de 30 min : les envois repartent de zéro.
    await banc.en(
      { id: S },
      "select public.modifier_session($1, 'Déplacée', '', now() + interval '30 minutes', 60, 'https://meet.google.com/abc-defg-hij', null, $2)",
      [id, FA],
    );
    const { annonce } = await un<{ annonce: string | null }>("select debut_annonce_le as annonce from public.sessions_live where id = $1", [id]);
    expect(annonce).toBeNull();
    await banc.db.query("delete from public.notifications");
    expect(await traiter()).toBe(1);
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Session live dans moins d’une heure"]);
    // À la nouvelle heure, le début est annoncé de nouveau.
    await banc.db.query("update public.sessions_live set debut = now() - interval '1 minute' where id = $1", [id]);
    expect(await traiter()).toBe(comptes - 1);
  });
});

describe("Droits et filet de la cloche", () => {
  it("rappels_sessions() d'un compte traite aussi les rappels des autres inscrits", async () => {
    const id = await session("8 minutes");
    await inscrire(E2, id);
    await banc.en({ id: NI }, "select public.rappels_sessions()");
    expect(await recues(E2)).toHaveLength(1);
  });

  it("traiter_sessions_live() n'est pas ouverte aux comptes", async () => {
    await expect(banc.en({ id: E1 }, "select public.traiter_sessions_live()")).rejects.toThrow(REFUS);
    await expect(banc.en("anon", "select public.traiter_sessions_live()")).rejects.toThrow(REFUS);
  });
});
