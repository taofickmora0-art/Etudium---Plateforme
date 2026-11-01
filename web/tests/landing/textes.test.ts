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

  it("trois abonnements qui ne diffèrent que par leur durée ; seul Standard est recommandé (restructuration, §5.2)", () => {
    expect(FORMULES.map((f) => [f.nom, f.description])).toEqual([
      ["Basique", "3 mois"],
      ["Standard", "6 mois"],
      ["Premium", "1 an"],
    ]);
    expect(FORMULES.filter((f) => f.recommandee).map((f) => f.nom)).toEqual(["Standard"]);
    for (const f of FORMULES) {
      expect(f.points).toEqual(["Toutes les formations et tous les parcours", "La communauté complète", "Les lives et leurs replays", "Les certificats vérifiables"]);
    }
    expect(ETAPES[1].texte).toBe("Basique, Standard ou Premium : 3 mois, 6 mois ou 1 an, avec accès à toutes les formations. Paiement par Mobile Money.");
  });

  it("les questions fréquentes parlent du nouveau modèle : tous les parcours, plus de formations complémentaires", () => {
    const parcours = QUESTIONS_FREQUENTES.find((q) => q.question === "Ai-je accès à tous les parcours ?");
    expect(parcours?.reponse).toBe("Oui. Tous les abonnements donnent accès à tous les parcours et à toutes les formations.");
    expect(QUESTIONS_FREQUENTES.map((q) => q.question)).not.toContain("Puis-je changer de parcours ?");
    for (const q of QUESTIONS_FREQUENTES) expect(q.reponse, q.question).not.toMatch(/complémentaire/);
  });

  it("6 points pour chacun des trois parcours du lancement, 4 problèmes, 4 étapes, 4 atouts", () => {
    for (const slug of ["reussite-academique", "competences-digitales", "business-revenus-en-ligne"]) expect(POINTS_PARCOURS[slug], slug).toHaveLength(6);
    expect(PROBLEMES).toHaveLength(4);
    expect(ETAPES).toHaveLength(4);
    expect(ATOUTS).toHaveLength(4);
  });
});
