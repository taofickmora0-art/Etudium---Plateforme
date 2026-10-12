import { describe, expect, it } from "vitest";
import { metadonneesFiche } from "@/lib/catalogue/partage";
import type { FicheFormation } from "@/lib/catalogue/types";
import { parSlug } from "./cartes-design";

const FICHE: FicheFormation = {
  ...parSlug("maitriser-microsoft-excel"),
  seuilVideo: 90,
  description: "Des formules aux tableaux croisés dynamiques, apprenez à analyser vos données de mémoire et à présenter des résultats clairs.",
  objectifs: [],
  competences: [],
  formateur: null,
  modules: [],
};

describe("Aperçu du lien partagé", () => {
  it("les métadonnées reprennent le titre et le résumé", () => {
    const meta = metadonneesFiche(FICHE);
    expect(meta.title).toBe("Maîtriser Microsoft Excel · Étudium");
    expect(meta.description).toBe("Formules, tableaux croisés dynamiques et graphiques pour analyser vos données.");
    expect(meta.openGraph).toMatchObject({
      title: "Maîtriser Microsoft Excel",
      description: "Formules, tableaux croisés dynamiques et graphiques pour analyser vos données.",
      type: "website",
      locale: "fr_FR",
      siteName: "Étudium",
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("sans résumé, la description est coupée à 160 caractères, sur un mot", () => {
    const longue = "Une description très détaillée ".repeat(10).trim();
    const meta = metadonneesFiche({ ...FICHE, resume: "", description: longue });
    const description = String(meta.description);
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    expect(longue.startsWith(description.slice(0, -1).trimEnd())).toBe(true);
  });

  it("une formation inconnue n'a pas de métadonnées de partage", () => {
    expect(metadonneesFiche(null)).toEqual({ title: "Formation introuvable · Étudium" });
  });
});
