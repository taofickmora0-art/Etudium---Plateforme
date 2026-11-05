import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0078, les parcours (ta décision du 5 novembre 2026) : Compétences digitales reprend le contenu de Business
// (formations, livres, sessions), et la place de Business devient Entrepreneuriat, avec ses discussions (groupe,
// communauté). Le lien « compétences à vendre » (0048) part d'une formation de Compétences digitales ou d'Entrepreneuriat.

const MIGRATION = join(process.cwd(), "supabase/migrations/0078_blocage_et_parcours.sql");
let banc: Banc;
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const id = async (table: string, slug: string) => (await un<{ id: string }>(`select id from public.${table} where slug = $1`, [slug])).id;
const refus = (p: Promise<unknown>) => p.then(() => "accepté", (e: Error) => e.message);
/** Les formations d'un parcours, dans leur ordre. */
const formationsDe = async (parcours: string) =>
  (
    await banc.db.query<{ slug: string }>(
      "select f.slug from public.formations_parcours fp join public.formations f on f.id = fp.formation_id join public.parcours p on p.id = fp.parcours_id where p.slug = $1 order by fp.ordre, f.slug",
      [parcours],
    )
  ).rows.map((r) => r.slug);

beforeAll(async () => {
  banc = await creerBanc(["tests/db/realtime-simule.sql", ...migrationsJusqua("0077")]);
  const digital = await id("parcours", "competences-digitales");
  const business = await id("parcours", "business-revenus-en-ligne");
  for (const slug of ["canva", "freelance", "boutique", "academique"])
    await banc.db.query("insert into public.formations (slug, titre, statut, publiee_le) values ($1, $1, 'publiee', now())", [slug]);
  const f = async (slug: string) => id("formations", slug);
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, 1)", [await f("canva"), digital]);
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, 1), ($3, $2, 2)", [await f("freelance"), business, await f("boutique")]);
  // « boutique » est déjà dans les deux parcours : elle n'y sera qu'une fois.
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, 2)", [await f("boutique"), digital]);
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, 1)", [await f("academique"), await id("parcours", "reussite-academique")]);
  await banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [await f("freelance"), await f("canva")]);
  await banc.db.query("insert into public.livres (slug, titre) values ('vendre-en-ligne', 'Vendre en ligne')");
  await banc.db.query("insert into public.livres_parcours (livre_id, parcours_id) values ($1, $2)", [await id("livres", "vendre-en-ligne"), business]);
  await banc.db.query("insert into public.sessions_live (titre, debut, lien, parcours_id) values ('Trouver ses clients', now(), 'https://exemple.org', $1)", [business]);
  // Deux passages : la migration se relance sans rien changer de plus.
  const sql = readFileSync(MIGRATION, "utf8");
  await banc.db.exec(sql);
  await banc.db.exec(sql);
}, 180_000);

describe("Les trois parcours", () => {
  it("Réussite académique, Compétences digitales, puis Entrepreneuriat (la place de Business, sa couleur orange)", async () => {
    const parcours = (await banc.db.query<{ slug: string; nom: string; nom_court: string; couleur: string }>("select slug, nom, nom_court, couleur from public.parcours order by ordre")).rows;
    expect(parcours.map((p) => [p.slug, p.nom, p.nom_court, p.couleur])).toEqual([
      ["reussite-academique", "Réussite académique", "Académique", "academique"],
      ["competences-digitales", "Compétences digitales", "Digital", "digital"],
      ["entrepreneuriat", "Entrepreneuriat", "Entrepreneuriat", "business"],
    ]);
  });

  it("Compétences digitales reprend les formations, livres et sessions de Business ; Entrepreneuriat part vide", async () => {
    expect(await formationsDe("competences-digitales")).toEqual(["canva", "boutique", "freelance"]);
    expect(await formationsDe("entrepreneuriat")).toEqual([]);
    const livre = await un<{ slug: string }>("select p.slug from public.livres_parcours lp join public.parcours p on p.id = lp.parcours_id");
    expect(livre.slug).toBe("competences-digitales");
    const session = await un<{ slug: string }>("select p.slug from public.sessions_live s join public.parcours p on p.id = s.parcours_id");
    expect(session.slug).toBe("competences-digitales");
  });

  it("le groupe de Business devient celui d'Entrepreneuriat (nom et adresse)", async () => {
    const groupe = await un<{ slug: string; nom: string }>("select g.slug, g.nom from public.groupes g join public.parcours p on p.id = g.parcours_id where p.slug = 'entrepreneuriat'");
    expect(groupe).toEqual({ slug: "entrepreneuriat", nom: "Entrepreneuriat" });
  });

  it("« compétences à vendre » : depuis Compétences digitales ou Entrepreneuriat, jamais depuis Réussite académique", async () => {
    const f = async (slug: string) => id("formations", slug);
    expect(Number((await un<{ n: number }>("select count(*) as n from public.formations_monetisation")).n)).toBe(1);
    expect(await refus(banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [await f("boutique"), await f("canva")]))).toBe("accepté");
    await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id) values ($1, $2)", [await f("academique"), await id("parcours", "entrepreneuriat")]);
    expect(await refus(banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [await f("academique"), await f("canva")]))).toBe("accepté");
    await banc.db.query("delete from public.formations_parcours where formation_id = $1 and parcours_id = $2", [await f("academique"), await id("parcours", "entrepreneuriat")]);
    await banc.db.query("delete from public.formations_monetisation where business_id = $1", [await f("academique")]);
    expect(await refus(banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [await f("academique"), await f("canva")]))).toBe(
      "Seule une formation de Compétences digitales ou d’Entrepreneuriat se lie à une compétence.",
    );
  });
});
