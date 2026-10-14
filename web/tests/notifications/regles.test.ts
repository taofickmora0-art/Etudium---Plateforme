import { describe, expect, it } from "vitest";
import { ANNONCE_TEXTE_MAX, ANNONCE_TITRE_MAX, EVENEMENT_NOTIFICATIONS, lienDuSite, NOMBRE_CLOCHE, NOMBRE_PAGE } from "@/lib/notifications/regles";

describe("Règles des notifications", () => {
  it("les nombres de la spec", () => {
    expect([NOMBRE_CLOCHE, NOMBRE_PAGE, ANNONCE_TITRE_MAX, ANNONCE_TEXTE_MAX]).toEqual([8, 20, 80, 300]);
    expect(EVENEMENT_NOTIFICATIONS).toBe("etudium:notifications");
  });

  it("lienDuSite : une adresse du site seulement", () => {
    for (const lien of ["/", "/formations/excel", "/profil?onglet=notifications"]) expect(lienDuSite(lien), lien).toBe(true);
    for (const lien of ["https://a.b", "//a.b", "javascript:alert(1)", "/\\a", "/a b", "formations", ""]) expect(lienDuSite(lien), lien).toBe(false);
  });
});
