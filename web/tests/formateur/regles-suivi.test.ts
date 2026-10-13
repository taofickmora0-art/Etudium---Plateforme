import { describe, expect, it } from "vitest";
import { dureeVideo, ETATS_SUIVI, FILTRES_SUIVI, inactivite, LIGNES_PAR_PAGE, REMARQUE_MAX, TON_SUIVI } from "@/lib/formateur/regles-suivi";

// Règles d'affichage du suivi des étudiants (spec « Étudiants » et tableau de bord du formateur, §2 à §4).

describe("Règles du suivi", () => {
  it("états, tons, filtres, constantes", () => {
    expect(ETATS_SUIVI).toEqual({ en_cours: "En cours", a_risque: "À risque", terminee: "Terminée" });
    expect(TON_SUIVI).toEqual({ en_cours: "compteur", a_risque: "echoue", terminee: "valide" });
    expect(FILTRES_SUIVI).toEqual([
      { value: "tous", label: "Tous" },
      { value: "a_risque", label: "À risque" },
      { value: "terminees", label: "Terminés" },
    ]);
    expect(LIGNES_PAR_PAGE).toBe(25);
    expect(REMARQUE_MAX).toBe(2000);
  });

  it("le temps de vidéo", () => {
    expect(dureeVideo(0)).toBe("Aucune vidéo regardée");
    expect(dureeVideo(30)).toBe("Moins d’une minute de vidéo");
    expect(dureeVideo(2700)).toBe("45 min de vidéo");
    expect(dureeVideo(3600)).toBe("1 h de vidéo");
    expect(dureeVideo(5100)).toBe("1 h 25 de vidéo");
  });

  it("l'inactivité, sans genre", () => {
    expect(inactivite(1)).toBe("Aucune activité depuis 1 jour");
    expect(inactivite(14)).toBe("Aucune activité depuis 14 jours");
  });
});
