import { describe, expect, it } from "vitest";
import { fieldErrorsFrom } from "@/lib/auth/schemas";
import { formationInfosSchema, lignes, parcoursSchema, ressourceSchema } from "@/lib/admin/schemas";

const erreurs = (resultat: { success: boolean; error?: Parameters<typeof fieldErrorsFrom>[0] }) =>
  resultat.success ? {} : fieldErrorsFrom(resultat.error!);

const PARCOURS = { nom: "Santé", nom_court: "Santé", slug: "sante", description: "", couleur: "academique", actif: true };
const FORMATION = {
  titre: "Excel",
  slug: "excel",
  resume: "",
  description: "",
  objectifs: [],
  competences: [],
  niveau: "debutant",
  formateur_id: null,
  gratuite: false,
  badge: null,
  seuil_video: 90,
};

describe("Règles de saisie du back-office", () => {
  it("un parcours sans nom est refusé", () => {
    expect(erreurs(parcoursSchema.safeParse({ ...PARCOURS, nom: "  " })).nom).toBe("Entrez le nom du parcours.");
    expect(parcoursSchema.safeParse(PARCOURS).success).toBe(true);
  });

  it("une adresse a des minuscules, des chiffres et des tirets seulement", () => {
    expect(erreurs(parcoursSchema.safeParse({ ...PARCOURS, slug: "Excel.js" })).slug).toBe("Lettres minuscules, chiffres et tirets seulement.");
    expect(erreurs(formationInfosSchema.safeParse({ ...FORMATION, slug: "node.js" })).slug).toBe("Lettres minuscules, chiffres et tirets seulement.");
  });

  it("le seuil de validation reste entre 50 et 100 %", () => {
    expect(erreurs(formationInfosSchema.safeParse({ ...FORMATION, seuil_video: 40 })).seuil_video).toBe("Entre 50 et 100 %.");
    expect(erreurs(formationInfosSchema.safeParse({ ...FORMATION, seuil_video: 101 })).seuil_video).toBe("Entre 50 et 100 %.");
    expect(formationInfosSchema.safeParse(FORMATION).success).toBe(true);
  });

  it("plus de prix par formation (restructuration, §5.2) : un prix envoyé est ignoré", () => {
    const lu = formationInfosSchema.safeParse({ ...FORMATION, prix_fcfa: -1 });
    expect(lu.success).toBe(true);
    expect(lu.data).not.toHaveProperty("prix_fcfa");
  });

  it("seuls les PDF et les images passent en consultation seule", () => {
    const base = { titre: "Données", fichier: "f/x.xlsx", format: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", taille_octets: 10 };
    expect(erreurs(ressourceSchema.safeParse({ ...base, telechargeable: false })).telechargeable).toBe(
      "Seuls les PDF et les images peuvent être en consultation seule.",
    );
    expect(ressourceSchema.safeParse({ ...base, telechargeable: true }).success).toBe(true);
    expect(ressourceSchema.safeParse({ ...base, format: "application/x-msdownload", telechargeable: true }).success).toBe(false);
  });

  it("les listes se saisissent une par ligne", () => {
    expect(lignes("A\n\n  B  \r\nC\n")).toEqual(["A", "B", "C"]);
    expect(lignes("")).toEqual([]);
  });
});
