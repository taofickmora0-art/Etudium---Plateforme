import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { CARTES_DESIGN } from "./cartes-design";

// Le lien compétence → monétisation (migration 0048 ; restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14). Dans
// les cartes de test, l'identifiant d'une formation est son adresse.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: vi.fn() }));

const { grouperBusiness, monetisationDe } = await import("@/lib/catalogue/monetisation");
const { lireMonetisation } = await import("@/lib/catalogue/data");

const LIENS = [
  { businessId: "lancer-son-activite-freelance", competenceId: "montage-video-smartphone" },
  { businessId: "lancer-son-activite-freelance", competenceId: "canva-debutant-a-expert" },
  { businessId: "marketing-digital-debutants", competenceId: "canva-debutant-a-expert" },
  // Une formation qui n'est plus au catalogue (archivée) : ignorée.
  { businessId: "formation-archivee", competenceId: "canva-debutant-a-expert" },
];
const slugs = (cartes: { slug: string }[]) => cartes.map((c) => c.slug);

describe("Ce qu'une fiche propose", () => {
  it("une compétence : les formations Business qui apprennent à la vendre, dans l'ordre du parcours Business", () => {
    const m = monetisationDe("canva-debutant-a-expert", LIENS, CARTES_DESIGN);
    expect(slugs(m.aVendre)).toEqual(["marketing-digital-debutants", "lancer-son-activite-freelance"]);
    expect(m.aSuivre).toEqual([]);
  });

  it("une formation Business : les compétences à suivre d'abord, dans l'ordre du parcours Digital", () => {
    const m = monetisationDe("lancer-son-activite-freelance", LIENS, CARTES_DESIGN);
    expect(slugs(m.aSuivre)).toEqual(["canva-debutant-a-expert", "montage-video-smartphone"]);
    expect(m.aVendre).toEqual([]);
  });

  it("sans lien : rien", () => {
    expect(monetisationDe("maitriser-microsoft-excel", LIENS, CARTES_DESIGN)).toEqual({ aVendre: [], aSuivre: [] });
  });
});

describe("L'onglet Business de la page Parcours", () => {
  it("les formations rangées par compétence (ordre du parcours Digital), puis « Pour toutes les compétences »", () => {
    const business = CARTES_DESIGN.filter((c) => c.parcours.some((p) => p.couleur === "business"));
    const sans = { ...business[0], id: "trouver-ses-prix", slug: "trouver-ses-prix", titre: "Fixer ses prix" };
    const groupes = grouperBusiness([...business, sans], LIENS, CARTES_DESIGN);
    expect(groupes.map((g) => [g.competence?.slug ?? null, slugs(g.formations)])).toEqual([
      ["canva-debutant-a-expert", ["marketing-digital-debutants", "lancer-son-activite-freelance"]],
      ["montage-video-smartphone", ["lancer-son-activite-freelance"]],
      [null, ["trouver-ses-prix"]],
    ]);
  });

  it("aucun lien : un seul groupe, « Pour toutes les compétences »", () => {
    const business = CARTES_DESIGN.filter((c) => c.parcours.some((p) => p.couleur === "business"));
    expect(grouperBusiness(business, [], CARTES_DESIGN).map((g) => [g.competence, slugs(g.formations)])).toEqual([
      [null, ["marketing-digital-debutants", "lancer-son-activite-freelance"]],
    ]);
  });
});

describe("La lecture des liens", () => {
  beforeEach(() => faux.vider());

  it("les liens de la base ; sans la 0048 ou en erreur : aucun", async () => {
    faux.repondre("formations_monetisation.select", { data: [{ business_id: "b", competence_id: "c" }] });
    expect(await lireMonetisation()).toEqual([{ businessId: "b", competenceId: "c" }]);
    faux.repondre("formations_monetisation.select", { error: { code: "42P01", message: "relation does not exist" } });
    expect(await lireMonetisation()).toEqual([]);
  });
});
