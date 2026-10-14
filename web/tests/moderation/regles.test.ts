import { describe, expect, it } from "vitest";
import { LIBELLES_CATEGORIES, LIBELLES_MOTIFS, messageBloquee, MOTIFS, PRECISIONS_MAX, refusSignalement } from "@/lib/moderation/regles";

describe("Règles de la modération", () => {
  it("libellés des catégories et des motifs (cahier des charges §31, design NdCommunaute)", () => {
    expect(LIBELLES_CATEGORIES).toEqual({
      spam: "Spam",
      harcelement: "Harcèlement",
      haine: "Haine",
      sexuel: "Contenu sexuel ou inapproprié",
      arnaque: "Arnaque",
      hameconnage: "Hameçonnage",
      publicite: "Publicité abusive",
      illegal: "Contenu illégal",
      hors_sujet: "Hors sujet",
      autre: "Autre violation des règles",
      aucune: "Aucune",
    });
    expect(MOTIFS.map((m) => LIBELLES_MOTIFS[m])).toEqual(["Contenu inapproprié", "Spam ou publicité", "Harcèlement", "Autre"]);
  });

  it("refusSignalement : Autre demande des précisions ; 500 caractères au plus", () => {
    expect(PRECISIONS_MAX).toBe(500);
    expect(refusSignalement("spam", "")).toBeNull();
    expect(refusSignalement("autre", " ")).toBe("Précisez le motif du signalement.");
    expect(refusSignalement("autre", "Fausse annonce")).toBeNull();
    expect(refusSignalement("spam", "x".repeat(501))).toBe("500 caractères au plus pour les précisions.");
  });

  it("messageBloquee : la catégorie lisible ; inconnue → « Autre violation des règles »", () => {
    expect(messageBloquee("arnaque")).toBe(
      "Votre publication n’a pas été publiée : elle semble enfreindre les règles de la communauté (Arnaque). Si c’est une erreur, l’équipe Étudium pourra la rétablir.",
    );
    expect(messageBloquee("inconnue")).toContain("(Autre violation des règles)");
    expect(messageBloquee(null)).toContain("(Autre violation des règles)");
  });
});
