import { describe, expect, it } from "vitest";
import { dateCourte } from "@/lib/utilisateurs/regles";
import {
  curseur,
  moment,
  NOMBRE_FIL,
  nomCourt,
  nomEspace,
  PIECE_MAX_OCTETS,
  refusPublication,
  refusReponse,
  REPONSE_MAX,
  tailleLisible,
  TEXTE_MAX,
  TITRE_MAX,
  TYPES_PIECE,
} from "@/lib/communaute/regles";

describe("Règles de la communauté", () => {
  it("les limites de la spec", () => {
    expect([TITRE_MAX, TEXTE_MAX, REPONSE_MAX, PIECE_MAX_OCTETS, NOMBRE_FIL]).toEqual([120, 3000, 1000, 10_485_760, 20]);
    expect(TYPES_PIECE).toEqual(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
  });

  it("refusPublication et refusReponse : les messages de la base", () => {
    expect(refusPublication("", "Bonjour")).toBeNull();
    expect(refusPublication("", "   ")).toBe("Écrivez votre publication (3 000 caractères au plus).");
    expect(refusPublication("", "x".repeat(3001))).toBe("Écrivez votre publication (3 000 caractères au plus).");
    expect(refusPublication("t".repeat(121), "ok")).toBe("Le titre dépasse 120 caractères.");
    expect(refusReponse("Merci")).toBeNull();
    expect(refusReponse(" ")).toBe("Écrivez votre réponse (1 000 caractères au plus).");
    expect(refusReponse("x".repeat(1001))).toBe("Écrivez votre réponse (1 000 caractères au plus).");
  });

  it("tailleLisible, nomCourt, nomEspace, curseur", () => {
    expect(tailleLisible(245_760)).toBe("240 Ko");
    expect(tailleLisible(1_258_291)).toBe("1,2 Mo");
    expect(tailleLisible(500)).toBe("1 Ko");
    expect([nomCourt("Koffi", "dossou"), nomCourt(" Awa ", ""), nomCourt("", "X")]).toEqual(["Koffi D.", "Awa", "Membre d’Étudium"]);
    expect(nomEspace({ id: null, nom: "général" })).toBe("Espace général");
    expect(nomEspace({ id: "p", nom: "Académique" })).toBe("Espace Académique");
    expect(curseur({ id: "a", creeLe: "2026-10-14T10:00:00Z" })).toEqual({ avant: "2026-10-14T10:00:00Z", avantId: "a" });
  });

  it("moment : à l’instant, il y a 5 min, il y a 2 h, hier, il y a 2 jours, puis la date (jour du Bénin)", () => {
    const maintenant = new Date("2026-10-14T15:00:00Z");
    expect(moment("2026-10-14T14:59:40Z", maintenant)).toBe("à l’instant");
    expect(moment("2026-10-14T14:55:00Z", maintenant)).toBe("il y a 5 min");
    expect(moment("2026-10-14T13:00:00Z", maintenant)).toBe("il y a 2 h");
    expect(moment("2026-10-13T16:00:00Z", maintenant)).toBe("il y a 23 h");
    expect(moment("2026-10-13T10:00:00Z", maintenant)).toBe("hier");
    expect(moment("2026-10-12T10:00:00Z", maintenant)).toBe("il y a 2 jours");
    expect(moment("2026-10-08T10:00:00Z", maintenant)).toBe("il y a 6 jours");
    expect(moment("2026-10-01T10:00:00Z", maintenant)).toBe(dateCourte("2026-10-01T10:00:00Z"));
  });
});
