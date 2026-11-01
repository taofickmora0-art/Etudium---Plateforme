import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0055 : le contenu riche des leçons (fin du lot 4, spec §1). Le document de l'éditeur dans
// `lecons_contenus.document`, l'espace privé `images_lecons` (dépôt par l'équipe et le formateur de la formation, lecture
// pour qui a accès à une leçon de la formation), la consigne riche dans l'écran de correction.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiante abonnée
const N = randomUUID(); // étudiant sans abonnement
let FORMATION: string;
let LECON: string;
let EXO: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const chemin = (formation = FORMATION) => `${formation}/${randomUUID()}.webp`;
const deposer = (qui: Qui, nom: string) =>
  banc.en(qui, "insert into storage.objects (bucket_id, name, metadata) values ('images_lecons', $1, $2::jsonb) returning name", [nom, JSON.stringify({ mimetype: "image/webp", size: 1000 })]);
const lit = async (qui: Qui, nom: string) => (await banc.en(qui, "select name from storage.objects where bucket_id = 'images_lecons' and name = $1", [nom])).length;
const DOC = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] }] };

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0055"));
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []], [N, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Excel', $1, $2) returning id", [randomUUID(), fiche])).id;
  const idModule = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [FORMATION])).id;
  LECON = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, ordre) values ($1, 'Les tableaux', true, 1) returning id", [idModule])).id;
  EXO = (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, 'Exercice', 'exercice', true, 2) returning id", [idModule])).id;
  await banc.db.query("insert into public.lecons_contenus (lecon_id) values ($1), ($2)", [LECON, EXO]);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [FORMATION]);
  await abonner(banc, E);
});

describe("Migration 0055 : le contenu riche", () => {
  it("le document s'enregistre ; un tableau JSON ou un document trop lourd est refusé", async () => {
    await banc.en({ id: F }, "update public.lecons_contenus set document = $2::jsonb where lecon_id = $1", [LECON, JSON.stringify(DOC)]);
    expect((await un<{ document: unknown }>("select document from public.lecons_contenus where lecon_id = $1", [LECON])).document).toEqual(DOC);
    await expect(banc.db.query("update public.lecons_contenus set document = '[]'::jsonb where lecon_id = $1", [LECON])).rejects.toThrow(/lecons_contenus_document_valide/);
    const lourd = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(310_000) }] }] };
    await expect(banc.db.query("update public.lecons_contenus set document = $2::jsonb where lecon_id = $1", [LECON, JSON.stringify(lourd)])).rejects.toThrow(
      /lecons_contenus_document_valide/,
    );
  });

  it("l'espace des images est privé, limité à 5 Mo et aux images JPEG, PNG et WebP", async () => {
    expect(await un("select public, file_size_limit::int as file_size_limit, allowed_mime_types from storage.buckets where id = 'images_lecons'")).toEqual({
      public: false,
      file_size_limit: 5242880,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
  });

  it("images : l'équipe et le formateur de la formation déposent ; un autre formateur et un étudiant non", async () => {
    expect(await deposer({ id: S }, chemin())).toHaveLength(1);
    expect(await deposer({ id: F }, chemin())).toHaveLength(1);
    await expect(deposer({ id: G }, chemin())).rejects.toThrow(/row-level security/);
    await expect(deposer({ id: E }, chemin())).rejects.toThrow(/row-level security/);
    await expect(deposer("anon", chemin())).rejects.toThrow(/row-level security|permission/);
  });

  it("images : lecture pour qui a accès à une leçon de la formation ; pas pour un compte sans accès ni pour un visiteur", async () => {
    const nom = chemin();
    await deposer({ id: F }, nom);
    expect(await lit({ id: S }, nom)).toBe(1);
    expect(await lit({ id: F }, nom)).toBe(1);
    expect(await lit({ id: E }, nom)).toBe(1);
    expect(await lit({ id: N }, nom)).toBe(0);
    expect(await lit("anon", nom)).toBe(0);
    // Un chemin hors d'un dossier de formation : personne d'autre que l'équipe.
    const ailleurs = `${randomUUID()}/${randomUUID()}.webp`;
    await banc.db.query("insert into storage.objects (bucket_id, name) values ('images_lecons', $1)", [ailleurs]);
    expect(await lit({ id: E }, ailleurs)).toBe(0);
  });

  it("l'écran de correction reçoit la consigne riche", async () => {
    await banc.db.query("update public.lecons_contenus set document = $2::jsonb, texte = 'Bonjour' where lecon_id = $1", [EXO, JSON.stringify(DOC)]);
    const rendu = (await un<{ id: string }>("insert into public.rendus_exercices (lecon_id, profil_id, version) values ($1, $2, 1) returning id", [EXO, E])).id;
    const r = (await banc.en<{ r: { exercice: { consigne: string; consigne_document: unknown } } }>({ id: F }, "select public.rendu_a_corriger($1) as r", [rendu]))[0].r;
    expect(r.exercice).toMatchObject({ consigne: "Bonjour", consigne_document: DOC });
  });
});
