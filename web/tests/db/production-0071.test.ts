import { createHash, randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { jetonEnvois } from "@/lib/envois/config";
import { PARCOURS_LANCEMENT } from "@/lib/landing/textes";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0071 : la production (spec de la mise en ligne du 2 novembre 2026, §1.1).
//   - Les trois parcours de base, insérés s'ils n'existent pas (par adresse), avec les textes et l'ordre de
//     exemples/lot-1.sql ; un parcours qui existe déjà (base de test) n'est pas touché.
//   - Le jeton des envois sans manipulation, comme celui des paiements : l'appli le tire de sa clé Resend (ou VAPID) ;
//     un administrateur l'enregistre (« Activer les envois ») ; etat_envois dit au back-office s'il est reconnu.

const MIGRATION = "supabase/migrations/0071_production.sql";

const PARCOURS = [
  {
    slug: "reussite-academique",
    nom: "Réussite académique",
    nom_court: "Académique",
    description: "Les outils et méthodes pour réussir à l’université : bureautique, recherche, rédaction scientifique et soutenance.",
    couleur: "academique",
    ordre: 1,
    actif: true,
  },
  {
    slug: "competences-digitales",
    nom: "Compétences digitales",
    nom_court: "Digital",
    description: "Design, intelligence artificielle, contenu et automatisation : les compétences numériques recherchées.",
    couleur: "digital",
    ordre: 2,
    actif: true,
  },
  {
    slug: "business-revenus-en-ligne",
    nom: "Business & revenus en ligne",
    nom_court: "Business",
    description: "Freelance, produits digitaux et vente en ligne : créer une activité grâce au numérique.",
    couleur: "business",
    ordre: 3,
    actif: true,
  },
];

type Parcours = { id: string; slug: string; nom: string; nom_court: string; description: string; couleur: string; ordre: number; actif: boolean; modifie_le: Date };

const lireParcours = async (b: Banc) =>
  (await b.db.query<Parcours>("select id, slug, nom, nom_court, description, couleur::text as couleur, ordre, actif, modifie_le from public.parcours order by ordre, slug")).rows;
const sansSuivi = (lignes: Parcours[]) => lignes.map(({ slug, nom, nom_court, description, couleur, ordre, actif }) => ({ slug, nom, nom_court, description, couleur, ordre, actif }));

// Le jeton que calcule l'appli à partir de la clé Resend (src/lib/envois/config.ts).
const JETON = jetonEnvois({ RESEND_API_KEY: "re_test_cle_resend" })!;
const AUTRE = jetonEnvois({ VAPID_PRIVATE_KEY: "cle-privee-vapid" })!;

let banc: Banc;
const [SA, AD, MO, FO, ET, SU] = Array.from({ length: 6 }, () => randomUUID());
// SA : super admin ; AD : admin ; MO : modérateur ; FO : formateur ; ET : étudiant ; SU : admin suspendu.

const enregistrer = (qui: Qui, jeton: string | null) => banc.en(qui, "select public.enregistrer_jeton_envois($1)", [jeton]);
const etat = async (qui: Qui, jeton: string | null) => (await banc.en<{ r: string }>(qui, "select public.etat_envois($1) as r", [jeton]))[0].r;
const prendre = async (jeton: string) =>
  (await banc.en<{ r: { id: number; prise: string; titre: string; email: string | null }[] }>("anon", "select public.prendre_envois($1, $2, 20) as r", [jeton, ["email"]]))[0].r;

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0071"));
  for (const [id, roles] of [[SA, ["super_admin"]], [AD, ["admin"]], [MO, ["moderateur"]], [FO, ["formateur"]], [ET, []], [SU, ["admin"]]] as const) {
    await banc.creerCompte(id, [...roles]);
  }
  await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [SU, SA]);
  await banc.db.query("delete from public.envois");
});

describe("Migration 0071 : les trois parcours de base", () => {
  it("une base vide (0001 à 0071) a les trois parcours, avec leurs textes, leur ordre et leurs couleurs", async () => {
    expect(sansSuivi(await lireParcours(banc))).toEqual(PARCOURS);
    // La landing et le filtre du catalogue s'appuient sur ces adresses, ces noms et ces couleurs.
    expect(PARCOURS_LANCEMENT.map(({ slug, nom, couleur }) => ({ slug, nom, couleur }))).toEqual(PARCOURS.map(({ slug, nom, couleur }) => ({ slug, nom, couleur })));
    // Actifs : un visiteur les voit.
    expect((await banc.en<{ slug: string }>("anon", "select slug from public.parcours order by ordre")).map((p) => p.slug)).toEqual(PARCOURS.map((p) => p.slug));
  });

  it("des parcours qui existent déjà (base de test) ne sont pas modifiés ; seuls les absents sont créés", async () => {
    const test = await creerBanc(migrationsJusqua("0070"));
    await test.db.query(
      `insert into public.parcours (slug, nom, nom_court, description, couleur, ordre, actif, modifie_le)
       values ('reussite-academique', 'Réussite académique (revu)', 'Académ.', 'Texte revu au back-office.', 'academique', 7, false, now() - interval '3 days')`,
    );
    const avant = (await lireParcours(test))[0];
    await test.appliquer(MIGRATION);
    const apres = await lireParcours(test);
    expect(apres.find((p) => p.slug === "reussite-academique")).toEqual(avant);
    expect(sansSuivi(apres.filter((p) => p.slug !== "reussite-academique"))).toEqual(PARCOURS.slice(1));
    await test.db.close();
  });
});

describe("Migration 0071 : le jeton des envois", () => {
  it("le jeton de l'appli : 64 caractères hexadécimaux, propre à la clé", () => {
    expect(JETON).toMatch(/^[0-9a-f]{64}$/);
    expect(AUTRE).toMatch(/^[0-9a-f]{64}$/);
    expect(AUTRE).not.toBe(JETON);
  });

  it("avant l'activation : « à activer » (la 0058 avait posé un jeton au hasard)", async () => {
    expect(await etat({ id: AD }, JETON)).toBe("a_activer");
    await expect(prendre(JETON)).rejects.toThrow(/Jeton d’envoi non reconnu/);
  });

  it("enregistrer : refusé à un visiteur, à un étudiant, à un formateur, à un modérateur et à un admin suspendu", async () => {
    await expect(enregistrer("anon", JETON)).rejects.toThrow(/permission denied/);
    for (const qui of [ET, FO, MO]) await expect(enregistrer({ id: qui }, JETON)).rejects.toThrow(/Réservé aux administrateurs/);
    await expect(enregistrer({ id: SU }, JETON)).rejects.toThrow(/Accès réservé aux comptes connectés/);
    expect(await etat({ id: AD }, JETON)).toBe("a_activer");
  });

  it("enregistrer : un jeton trop court est refusé ; un admin enregistre l'empreinte, jamais le jeton", async () => {
    await expect(enregistrer({ id: AD }, "court")).rejects.toThrow(/au moins 32 caractères/);
    await expect(enregistrer({ id: AD }, null)).rejects.toThrow(/au moins 32 caractères/);
    await enregistrer({ id: AD }, JETON);
    const { empreinte } = (await banc.db.query<{ empreinte: string }>("select empreinte from public.reglages_envois where id")).rows[0];
    expect(empreinte).toBe(createHash("sha256").update(JETON, "utf8").digest("hex"));
    expect(empreinte).not.toContain(JETON);
  });

  it("ensuite, la file se prend avec ce jeton ; un autre jeton est refusé", async () => {
    await banc.db.query("insert into public.envois (canal, destinataire, titre) values ('email', $1, 'Bienvenue')", [ET]);
    const [envoi] = await prendre(JETON);
    expect(envoi).toMatchObject({ titre: "Bienvenue", email: `${ET.slice(0, 8)}@exemple.com` });
    await banc.en("anon", "select public.terminer_envoi($1, $2, $3, true, null, '{}')", [JETON, envoi.id, envoi.prise]);
    expect((await banc.db.query<{ statut: string }>("select statut from public.envois where id = $1", [envoi.id])).rows[0].statut).toBe("envoye");
    await expect(prendre(AUTRE)).rejects.toThrow(/Jeton d’envoi non reconnu/);
    await expect(banc.en("anon", "select public.terminer_envoi($1, $2, $3, true, null, '{}')", [AUTRE, envoi.id, envoi.prise])).rejects.toThrow(
      /Jeton d’envoi non reconnu/,
    );
  });

  it("etat_envois : « actifs » pour le jeton enregistré, « à activer » sinon ; réservé aux administrateurs connectés", async () => {
    expect(await etat({ id: AD }, JETON)).toBe("actifs");
    expect(await etat({ id: SA }, JETON)).toBe("actifs");
    for (const jeton of [AUTRE, "", null, JETON.slice(0, 20)]) expect(await etat({ id: AD }, jeton)).toBe("a_activer");
    await expect(etat("anon", JETON)).rejects.toThrow(/permission denied/);
    for (const qui of [ET, FO, MO]) await expect(etat({ id: qui }, JETON)).rejects.toThrow(/Réservé aux administrateurs/);
    await expect(etat({ id: SU }, JETON)).rejects.toThrow(/Accès réservé aux comptes connectés/);
  });

  it("un nouveau clic (clé changée) remplace l'ancien jeton", async () => {
    await enregistrer({ id: SA }, AUTRE);
    expect(await etat({ id: AD }, AUTRE)).toBe("actifs");
    expect(await etat({ id: AD }, JETON)).toBe("a_activer");
    await expect(prendre(JETON)).rejects.toThrow(/Jeton d’envoi non reconnu/);
    expect(await prendre(AUTRE)).toEqual([]);
    await enregistrer({ id: AD }, JETON);
  });

  it("les droits : ni le public ni les visiteurs n'exécutent les deux fonctions ; les comptes connectés, oui", async () => {
    const droits = (
      await banc.db.query<{ role: string; enregistrer: boolean; etat: boolean }>(
        `select r as role,
                has_function_privilege(r, 'public.enregistrer_jeton_envois(text)', 'execute') as enregistrer,
                has_function_privilege(r, 'public.etat_envois(text)', 'execute') as etat
         from unnest(array['anon', 'authenticated']) r`,
      )
    ).rows;
    expect(droits).toEqual([
      { role: "anon", enregistrer: false, etat: false },
      { role: "authenticated", enregistrer: true, etat: true },
    ]);
    const publics = (
      await banc.db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc p, aclexplode(p.proacl) a
         where p.proname in ('enregistrer_jeton_envois', 'etat_envois') and a.grantee = 0 and a.privilege_type = 'EXECUTE'`,
      )
    ).rows[0].n;
    expect(publics).toBe(0);
  });
});

describe("Migration 0071 : rejouée", () => {
  it("ne casse rien : mêmes parcours, jeton gardé, fonctions en place", async () => {
    const avant = await lireParcours(banc);
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect(await lireParcours(banc)).toEqual(avant);
    expect(await etat({ id: AD }, JETON)).toBe("actifs");
    expect(await prendre(JETON)).toEqual([]);
    await expect(enregistrer("anon", JETON)).rejects.toThrow(/permission denied/);
  });
});
