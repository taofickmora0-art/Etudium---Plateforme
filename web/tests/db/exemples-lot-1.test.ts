import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Données d'exemple du lot 1 (design « Nouveau design ») : seulement sur la base de test, jamais en production.
const EXEMPLES = "supabase/exemples/lot-1.sql";

const PARCOURS_ATTENDUS: Record<string, string> = {
  "maitriser-microsoft-excel": "reussite-academique",
  "microsoft-word-travaux-universitaires": "reussite-academique",
  "zotero-gerer-ses-references": "reussite-academique",
  "powerpoint-reussir-sa-soutenance": "reussite-academique",
  "methodologie-du-memoire": "reussite-academique",
  "canva-debutant-a-expert": "competences-digitales",
  "intelligence-artificielle-etudes": "competences-digitales",
  "montage-video-smartphone": "competences-digitales",
  "marketing-digital-debutants": "business-revenus-en-ligne",
  "lancer-son-activite-freelance": "business-revenus-en-ligne",
};

describe("Données d'exemple du lot 1", () => {
  let banc: Banc;
  const nombre = async (sql: string) => (await banc.db.query<{ n: number }>(sql)).rows[0].n;

  beforeAll(async () => {
    // Deux fois : le fichier doit se rejouer sans rien doubler.
    banc = await creerBanc([...MIGRATIONS_LOT_0, "supabase/migrations/0004_contenus.sql", EXEMPLES, EXEMPLES]);
  });

  it("les exemples se rejouent sans doublon", async () => {
    expect(await nombre("select count(*)::int as n from public.parcours")).toBe(3);
    expect(await nombre("select count(*)::int as n from public.formations")).toBe(10);
    expect(await nombre("select count(*)::int as n from public.formateurs")).toBe(1);
    expect(
      await nombre("select count(*)::int as n from public.modules m join public.formations f on f.id = m.formation_id where f.slug = 'maitriser-microsoft-excel'"),
    ).toBe(4);
    expect(
      await nombre(
        "select count(*)::int as n from public.lecons l join public.modules m on m.id = l.module_id join public.formations f on f.id = m.formation_id where f.slug = 'maitriser-microsoft-excel'",
      ),
    ).toBe(12);
  });

  it("un visiteur voit les 10 formations et les deux leçons d'aperçu d'Excel", async () => {
    const [{ n }] = await banc.en<{ n: number }>("anon", "select count(*)::int as n from public.formations");
    expect(n).toBe(10);
    const ouvertes = await banc.en<{ titre: string }>("anon", "select l.titre from public.lecons l where public.accessible(l) order by l.ordre");
    expect(ouvertes.map((l) => l.titre)).toEqual(["Découvrir l’interface", "Saisir et mettre en forme des données"]);
  });

  it("Zotero et Canva sont gratuites, Excel et Marketing se vendent seules", async () => {
    const slugs = async (colonne: string) =>
      (await banc.db.query<{ slug: string }>(`select slug from public.formations where ${colonne} order by slug`)).rows.map((r) => r.slug);
    expect(await slugs("gratuite")).toEqual(["canva-debutant-a-expert", "zotero-gerer-ses-references"]);
    expect(await slugs("achat_separe")).toEqual(["maitriser-microsoft-excel", "marketing-digital-debutants"]);
  });

  it("chaque formation appartient à son parcours", async () => {
    const { rows } = await banc.db.query<{ formation: string; parcours: string }>(
      "select f.slug as formation, p.slug as parcours from public.formations_parcours fp join public.formations f on f.id = fp.formation_id join public.parcours p on p.id = fp.parcours_id",
    );
    expect(Object.fromEntries(rows.map((r) => [r.formation, r.parcours]))).toEqual(PARCOURS_ATTENDUS);
  });

  it("la durée d'Excel se calcule à partir des leçons", async () => {
    expect(
      await nombre(
        "select sum(l.duree_secondes)::int as n from public.lecons l join public.modules m on m.id = l.module_id join public.formations f on f.id = m.formation_id where f.slug = 'maitriser-microsoft-excel'",
      ),
    ).toBe(8407);
  });

  it("la leçon des tableaux croisés dynamiques porte son résumé et ses 4 points clés", async () => {
    const { rows } = await banc.db.query<{ titre_court: string; points_cles: string[]; resume: string }>(
      "select titre_court, points_cles, resume from public.lecons where titre = 'Les tableaux croisés dynamiques'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].titre_court).toBe("Tableaux croisés dynamiques");
    expect(rows[0].points_cles).toEqual([
      "Créer un tableau croisé dynamique",
      "Modifier la structure du tableau",
      "Filtrer et trier les données",
      "Mettre en forme le tableau pour un rapport",
    ]);
    expect(rows[0].resume).toMatch(/^Un tableau croisé dynamique résume/);
  });

  it("le fichier d'exemples n'est pas une migration (il ne part jamais en production)", async () => {
    const { readdirSync } = await import("node:fs");
    expect(readdirSync("supabase/migrations").some((f) => /exemple/i.test(f))).toBe(false);
  });
});
