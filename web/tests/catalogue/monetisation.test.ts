import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { CARTES_DESIGN } from "./cartes-design";

// Le lien compétence → monétisation (migration 0048 ; restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14). Dans
// les cartes de test, l'identifiant d'une formation est son adresse.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: vi.fn() }));

const { monetisationDe } = await import("@/lib/catalogue/monetisation");
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

describe("La lecture des liens", () => {
  beforeEach(() => faux.vider());

  it("les liens de la base ; sans la 0048 ou en erreur : aucun", async () => {
    faux.repondre("formations_monetisation.select", { data: [{ business_id: "b", competence_id: "c" }] });
    expect(await lireMonetisation()).toEqual([{ businessId: "b", competenceId: "c" }]);
    faux.repondre("formations_monetisation.select", { error: { code: "42P01", message: "relation does not exist" } });
    expect(await lireMonetisation()).toEqual([]);
  });
});
