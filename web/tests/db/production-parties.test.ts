import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { creerBanc } from "./banc";

// Les fichiers de supabase/production (spec de la mise en ligne, §1.3), collés d'affilée sur une base vide, tels que
// l'utilisateur les collera dans l'éditeur SQL du projet de production : tout passe, et la base de départ est là.
const parties = readdirSync(join(process.cwd(), "supabase", "production"))
  .filter((f) => /^partie-\d+\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]))
  .map((f) => `supabase/production/${f}`);

describe("La base de production, partie par partie", () => {
  it("les parties s'appliquent d'affilée sur une base vide et posent la base de départ", async () => {
    expect(parties.length).toBeGreaterThan(1);
    const banc = await creerBanc(parties);
    const { rows: parcours } = await banc.db.query<{ slug: string; couleur: string }>("select slug, couleur::text from public.parcours order by ordre");
    expect(parcours).toEqual([
      { slug: "reussite-academique", couleur: "academique" },
      { slug: "competences-digitales", couleur: "digital" },
      // La 0078 : Business & revenus en ligne devient Entrepreneuriat (même couleur, orange).
      { slug: "entrepreneuriat", couleur: "business" },
    ]);
    const { rows: formations } = await banc.db.query<{ n: number }>("select count(*)::int as n from public.formations");
    expect(formations[0].n).toBe(0);
    const { rows: formules } = await banc.db.query<{ n: number }>("select count(*)::int as n from public.formules");
    expect(formules[0].n).toBe(3);
    const { rows: fonctions } = await banc.db.query<{ proname: string }>(
      `select proname from pg_proc join pg_namespace n on n.oid = pronamespace
        where nspname = 'public' and proname in ('acces_lecon', 's_inscrire_formation', 'formateur_public', 'enregistrer_jeton_envois', 'activer_paiements')
        order by proname`,
    );
    expect(fonctions.map((f) => f.proname)).toEqual(["acces_lecon", "activer_paiements", "enregistrer_jeton_envois", "formateur_public", "s_inscrire_formation"]);
  }, 180_000);
});
