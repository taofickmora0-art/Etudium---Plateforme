import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0011 : les chiffres du tableau de bord du back-office, réservés à l'équipe (admin, moderateur, super_admin).
const MIGRATION = "supabase/migrations/0011_statistiques.sql";
// Date de référence fixe : les comptes « de la semaine », « du mois » et « du mois précédent » en dépendent.
const MAINTENANT = "2026-10-20T12:00:00Z";

type Stats = {
  utilisateurs: number;
  inscrits_semaine: number;
  inscrits_mois: number;
  inscrits_mois_precedent: number;
  progression_moyenne: number | null;
  formations_suivies: { titre: string; slug: string; etudiants: number }[];
};

describe("Migration 0011 : statistiques du back-office", () => {
  let banc: Banc;
  const E1 = randomUUID();
  const E2 = randomUUID();
  const E3 = randomUUID();
  const ADMIN = randomUUID();
  const MODO = randomUUID();
  let excel: string;
  let courte: string;

  const stats = async (qui: "anon" | { id: string }) =>
    (await banc.en<{ s: Stats }>(qui, "select public.statistiques_back_office($1::timestamptz) as s", [MAINTENANT]))[0].s;
  const lecons = async (formation: string) =>
    (
      await banc.db.query<{ id: string }>(
        "select l.id from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $1 order by m.ordre, l.ordre",
        [formation],
      )
    ).rows.map((r) => r.id);
  const suivre = async (qui: string, ids: string[], terminees: number) => {
    for (const [i, id] of ids.entries()) {
      await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, terminee_le) values ($1, $2, $3)", [qui, id, i < terminees ? MAINTENANT : null]);
    }
  };

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
      "supabase/exemples/lot-1.sql",
      MIGRATION,
    ]);
    for (const qui of [E1, E2, E3]) await banc.creerCompte(qui);
    await banc.creerCompte(ADMIN, ["admin"]);
    await banc.creerCompte(MODO, ["moderateur"]);
    // Inscriptions : E1 il y a 2 jours (semaine et mois), E2 le 5 octobre (mois), E3 en septembre (mois précédent),
    // l'admin et le modérateur l'an dernier.
    await banc.db.query("update public.profils set cree_le = $2 where id = $1", [E1, "2026-10-18T09:00:00Z"]);
    await banc.db.query("update public.profils set cree_le = $2 where id = $1", [E2, "2026-10-05T09:00:00Z"]);
    await banc.db.query("update public.profils set cree_le = $2 where id = $1", [E3, "2026-09-12T09:00:00Z"]);
    await banc.db.query("update public.profils set cree_le = '2025-06-01T09:00:00Z' where id = any($1)", [[ADMIN, MODO]]);

    excel = (await banc.db.query<{ id: string }>("select id from public.formations where slug = 'maitriser-microsoft-excel'")).rows[0].id;
    courte = (
      await banc.db.query<{ id: string }>(
        "insert into public.formations (slug, titre, statut, publiee_le) values ('formation-courte', 'Formation courte', 'publiee', now()) returning id",
      )
    ).rows[0].id;
    const mod = (await banc.db.query<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Seul module', 1) returning id", [courte])).rows[0].id;
    await banc.db.query("insert into public.lecons (module_id, titre, duree_secondes, ordre) values ($1, 'Une', 60, 1), ($1, 'Deux', 60, 2)", [mod]);

    // Progression : E1 a terminé 6 leçons d'Excel sur 12 (50 %) et la formation courte (100 %) ; E2 a ouvert une leçon
    // d'Excel sans la terminer (0 %). Moyenne : (50 + 100 + 0) / 3 = 50.
    await suivre(E1, (await lecons(excel)).slice(0, 6), 6);
    await suivre(E1, await lecons(courte), 2);
    await suivre(E2, (await lecons(excel)).slice(0, 1), 0);
  });

  it("utilisateurs, inscrits de la semaine, du mois et du mois précédent", async () => {
    expect(await stats({ id: ADMIN })).toMatchObject({ utilisateurs: 5, inscrits_semaine: 1, inscrits_mois: 2, inscrits_mois_precedent: 1 });
  });

  it("progression moyenne des formations commencées, et les formations les plus suivies", async () => {
    const s = await stats({ id: ADMIN });
    expect(s.progression_moyenne).toBe(50);
    expect(s.formations_suivies).toEqual([
      { titre: "Maîtriser Microsoft Excel", slug: "maitriser-microsoft-excel", etudiants: 2 },
      { titre: "Formation courte", slug: "formation-courte", etudiants: 1 },
    ]);
  });

  it("une formation archivée ne figure pas parmi les plus suivies", async () => {
    await banc.db.query("update public.formations set statut = 'archivee' where id = $1", [courte]);
    expect((await stats({ id: ADMIN })).formations_suivies.map((f) => f.slug)).toEqual(["maitriser-microsoft-excel"]);
    await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [courte]);
  });

  it("réservé à l'équipe : le modérateur lit, un étudiant et un visiteur sont refusés", async () => {
    expect((await stats({ id: MODO })).utilisateurs).toBe(5);
    await expect(stats({ id: E1 })).rejects.toMatchObject({ code: "42501" });
    await expect(stats("anon")).rejects.toThrow();
  });

  it("sans progression : pas de moyenne ; la migration se rejoue", async () => {
    await banc.appliquer(MIGRATION);
    await banc.db.query("delete from public.progression_lecons");
    const s = await stats({ id: ADMIN });
    expect(s.progression_moyenne).toBeNull();
    expect(s.formations_suivies).toEqual([]);
  });
});
