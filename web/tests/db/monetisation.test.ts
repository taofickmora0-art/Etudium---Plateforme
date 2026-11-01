import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0048 (restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14) : le lien compétence → monétisation. Une
// formation du parcours Business indique les formations de Compétences digitales qu'elle apprend à vendre. Le formateur de
// la formation Business ou l'équipe le règle ; tout le monde le lit, pour des formations qu'il peut voir.

let banc: Banc;
const S = randomUUID(); // équipe
const F = randomUUID(); // formateur de « Lancer son activité de freelance »
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiant
const ids: Record<string, string> = {};

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const lier = (qui: string, business: string, competence: string) =>
  banc.en({ id: qui }, "insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [ids[business], ids[competence]]);
const liens = async (qui: string | "anon") =>
  (await banc.en<{ b: string; c: string }>(
    qui === "anon" ? "anon" : { id: qui },
    "select b.slug as b, c.slug as c from public.formations_monetisation m join public.formations b on b.id = m.business_id join public.formations c on c.id = m.competence_id order by 1, 2",
  )).map((l) => [l.b, l.c]);

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...["0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques"].map(
      (m) => `supabase/migrations/${m}.sql`,
    ),
    "supabase/exemples/lot-1.sql",
    ...["0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique", "0047_sans_achat_seul", "0048_monetisation"].map(
      (m) => `supabase/migrations/${m}.sql`,
    ),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const compte of [F, G]) await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [compte]);
  for (const { slug, id } of (await banc.db.query<{ slug: string; id: string }>("select slug, id from public.formations")).rows) ids[slug] = id;
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  await banc.db.query("update public.formations set formateur_id = $1 where slug = 'lancer-son-activite-freelance'", [fiche]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.formations_monetisation");
});

describe("Le lien compétence → monétisation", () => {
  it("l'équipe lie une formation Business à des compétences ; tout le monde le lit, visiteur compris", async () => {
    await lier(S, "lancer-son-activite-freelance", "canva-debutant-a-expert");
    await lier(S, "lancer-son-activite-freelance", "montage-video-smartphone");
    await lier(S, "marketing-digital-debutants", "canva-debutant-a-expert");
    expect(await liens("anon")).toEqual([
      ["lancer-son-activite-freelance", "canva-debutant-a-expert"],
      ["lancer-son-activite-freelance", "montage-video-smartphone"],
      ["marketing-digital-debutants", "canva-debutant-a-expert"],
    ]);
    expect(await liens(E)).toHaveLength(3);
  });

  it("seulement d'une formation Business vers une compétence publiée de Compétences digitales", async () => {
    await expect(lier(S, "maitriser-microsoft-excel", "canva-debutant-a-expert")).rejects.toThrow("Seule une formation du parcours Business se lie à une compétence.");
    await expect(lier(S, "lancer-son-activite-freelance", "maitriser-microsoft-excel")).rejects.toThrow("Choisissez une formation publiée du parcours Compétences digitales.");
    await banc.db.query("update public.formations set statut = 'brouillon' where slug = 'montage-video-smartphone'");
    await expect(lier(S, "lancer-son-activite-freelance", "montage-video-smartphone")).rejects.toThrow("Choisissez une formation publiée du parcours Compétences digitales.");
    await banc.db.query("update public.formations set statut = 'publiee' where slug = 'montage-video-smartphone'");
  });

  it("le formateur de la formation Business la lie et la délie ; un autre formateur ou un étudiant, non", async () => {
    await lier(F, "lancer-son-activite-freelance", "canva-debutant-a-expert");
    await expect(lier(G, "lancer-son-activite-freelance", "montage-video-smartphone")).rejects.toThrow(/row-level security/);
    await expect(lier(E, "lancer-son-activite-freelance", "montage-video-smartphone")).rejects.toThrow(/row-level security/);
    await expect(lier(F, "marketing-digital-debutants", "canva-debutant-a-expert")).rejects.toThrow(/row-level security/);
    await banc.en({ id: F }, "delete from public.formations_monetisation where business_id = $1", [ids["lancer-son-activite-freelance"]]);
    expect(await liens(S)).toEqual([]);
  });

  it("une formation Business pas encore publiée : son lien n'est visible que de l'équipe", async () => {
    await lier(S, "lancer-son-activite-freelance", "canva-debutant-a-expert");
    await banc.db.query("update public.formations set statut = 'brouillon' where slug = 'lancer-son-activite-freelance'");
    expect(await liens("anon")).toEqual([]);
    expect(await liens(S)).toHaveLength(1);
    await banc.db.query("update public.formations set statut = 'publiee' where slug = 'lancer-son-activite-freelance'");
  });
});
