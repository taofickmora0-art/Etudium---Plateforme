import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0047 (restructuration, §5.2 ; liste du 31 octobre 2026, tâche 13) : plus de formation achetée seule ni de
// prix par formation. Les colonnes disparaissent ; le formateur crée et modifie toujours ses formations, et les réglages
// de l'équipe restent les siens.

let banc: Banc;
const S = randomUUID();
const F = randomUUID();
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...["0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques"].map(
      (m) => `supabase/migrations/${m}.sql`,
    ),
    "supabase/exemples/lot-1.sql",
    ...["0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique", "0047_sans_achat_seul"].map(
      (m) => `supabase/migrations/${m}.sql`,
    ),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
});

describe("Plus d'achat seul", () => {
  it("les colonnes « achat_separe » et « prix_fcfa » n'existent plus ; les données d'exemple passent", async () => {
    const colonnes = (await banc.db.query<{ c: string }>(
      "select column_name as c from information_schema.columns where table_schema = 'public' and table_name = 'formations'",
    )).rows.map((r) => r.c);
    expect(colonnes).not.toContain("achat_separe");
    expect(colonnes).not.toContain("prix_fcfa");
    expect((await un<{ n: number }>("select count(*)::int as n from public.formations")).n).toBe(10);
  });

  it("le formateur crée et modifie sa formation ; un réglage de l'équipe lui reste refusé", async () => {
    const id = (await banc.en<{ id: string }>({ id: F }, "insert into public.formations (titre, slug) values ('Excel avancé', $1) returning id", [`f-${randomUUID()}`]))[0].id;
    await banc.en({ id: F }, "update public.formations set titre = 'Excel avancé, 2e édition' where id = $1", [id]);
    expect((await un<{ titre: string }>("select titre from public.formations where id = $1", [id])).titre).toBe("Excel avancé, 2e édition");
    await expect(banc.en({ id: F }, "update public.formations set gratuite = true where id = $1", [id])).rejects.toThrow("Ce réglage revient à l’équipe Étudium.");
  });
});
