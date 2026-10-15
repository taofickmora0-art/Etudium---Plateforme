import { describe, expect, it } from "vitest";
import { ATOUTS, ETAPES, FORMULES, POINTS_PARCOURS, PROBLEMES } from "@/lib/landing/textes";
import { QUESTIONS_FREQUENTES } from "@/lib/site/faq";

describe("Textes fixes de la landing (annexe §23)", () => {
  it("les 7 questions fréquentes du design, dans l'ordre", () => {
    expect(QUESTIONS_FREQUENTES).toHaveLength(7);
    expect(QUESTIONS_FREQUENTES[0].question).toBe("Le compte gratuit est-il vraiment gratuit ?");
    expect(QUESTIONS_FREQUENTES[6].question).toBe("Puis-je suivre les formations sur mon téléphone ?");
  });

  it("aucune apostrophe droite dans les textes affichés", () => {
    const tous = [
      ...QUESTIONS_FREQUENTES.flatMap((q) => [q.question, q.reponse]),
      ...[...PROBLEMES, ...ETAPES, ...ATOUTS].flatMap((t) => [t.titre, t.texte]),
      ...FORMULES.flatMap((f) => [f.nom, f.description, ...f.points]),
      ...Object.values(POINTS_PARCOURS).flat(),
    ];
    for (const texte of tous) expect(texte, texte).not.toContain("'");
  });

  it("trois formules, seule Standard est recommandée", () => {
    expect(FORMULES.map((f) => f.nom)).toEqual(["Basique", "Standard", "Premium"]);
    expect(FORMULES.filter((f) => f.recommandee).map((f) => f.nom)).toEqual(["Standard"]);
    for (const f of FORMULES) expect(f.points).toHaveLength(3);
  });

  it("6 points pour chacun des trois parcours du lancement, 4 problèmes, 4 étapes, 4 atouts", () => {
    for (const slug of ["reussite-academique", "competences-digitales", "business-revenus-en-ligne"]) expect(POINTS_PARCOURS[slug], slug).toHaveLength(6);
    expect(PROBLEMES).toHaveLength(4);
    expect(ETAPES).toHaveLength(4);
    expect(ATOUTS).toHaveLength(4);
  });
});
