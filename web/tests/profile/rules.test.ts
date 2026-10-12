import { describe, expect, it } from "vitest";
import { labelOf, NIVEAUX, PAYS } from "@/lib/profile/options";
import { CHANNELS, NOTIFICATION_CATEGORIES, readPreferences } from "@/lib/profile/preferences";
import { passwordChangeSchema, preferencesSchema, profileSchema } from "@/lib/profile/schemas";

const PROFIL = { prenom: "Aïcha", nom: "Kpadé", telephone: "", pays: "", niveau_etudes: "", etablissement: "", filiere: "", objectifs: "" };
const premiereErreur = (valeurs: Record<string, unknown>, champ: string) => {
  const r = profileSchema.safeParse({ ...PROFIL, ...valeurs });
  return r.success ? undefined : r.error.issues.find((i) => i.path[0] === champ)?.message;
};

describe("Listes du profil", () => {
  it("les listes suivent l'ordre prévu", () => {
    expect(PAYS[0]).toEqual({ value: "benin", label: "Bénin" });
    expect(PAYS.at(-1)).toEqual({ value: "autre", label: "Autre pays" });
    expect(NIVEAUX.map((n) => n.value)).toEqual(["bts_dut", "licence_1", "licence_2", "licence_3", "master_1", "master_2", "doctorat", "jeune_diplome", "autre"]);
    expect(labelOf(NIVEAUX, "jeune_diplome")).toBe("Jeune diplômé(e)");
    expect(labelOf(PAYS, "inconnu")).toBeNull();
  });
});

describe("Préférences de notification", () => {
  it("les préférences manquantes sont activées", () => {
    const toutes = readPreferences({});
    expect(Object.keys(toutes)).toHaveLength(10);
    expect(Object.values(toutes).every(Boolean)).toBe(true);
    const lues = readPreferences({ recommandations: false, inconnue: false });
    expect(lues.recommandations).toBe(false);
    expect(Object.values(lues).filter((v) => !v)).toHaveLength(1);
    expect(lues).not.toHaveProperty("inconnue");
    expect(Object.values(readPreferences("x")).every(Boolean)).toBe(true);
  });

  it("les 8 catégories et les 2 canaux du design", () => {
    expect(NOTIFICATION_CATEGORIES.map((c) => c.key)).toEqual([
      "nouveaux_contenus",
      "sessions_live",
      "expiration_renouvellement",
      "exercices",
      "rappels_apprentissage",
      "communaute",
      "recommandations",
      "annonces",
    ]);
    expect(NOTIFICATION_CATEGORIES[1]).toEqual({ key: "sessions_live", label: "Sessions live", description: "Programmation et rappels 1 h avant" });
    expect(CHANNELS.map((c) => c.label)).toEqual(["Notifications dans l’appli", "Notifications push"]);
  });

  it("les préférences reçues sont complètes et booléennes", () => {
    const completes = readPreferences({});
    expect(preferencesSchema.safeParse(completes).success).toBe(true);
    const { annonces, ...sansAnnonces } = completes;
    void annonces;
    expect(preferencesSchema.safeParse(sansAnnonces).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...completes, annonces: "oui" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ ...completes, en_trop: true }).success).toBe(false);
  });
});

describe("Règles de saisie du profil", () => {
  it("le profil est nettoyé avant l'enregistrement", () => {
    const r = profileSchema.parse({ ...PROFIL, prenom: " Aïcha ", telephone: "", pays: "benin", objectifs: " " });
    expect(r).toMatchObject({ prenom: "Aïcha", telephone: null, pays: "benin", objectifs: null, niveau_etudes: null });
  });

  it("chaque erreur est expliquée", () => {
    expect(premiereErreur({ prenom: "   " }, "prenom")).toBe("Entrez votre prénom.");
    expect(premiereErreur({ telephone: "abc" }, "telephone")).toBe("Saisissez un numéro de téléphone valide.");
    expect(premiereErreur({ telephone: "+229 01 97 00 00 00" }, "telephone")).toBeUndefined();
    expect(premiereErreur({ pays: "atlantide" }, "pays")).toBe("Choisissez un pays de la liste.");
    expect(premiereErreur({ niveau_etudes: "x" }, "niveau_etudes")).toBe("Choisissez un niveau de la liste.");
    expect(premiereErreur({ etablissement: "a".repeat(121) }, "etablissement")).toBe("120 caractères au maximum.");
    expect(premiereErreur({ objectifs: "a".repeat(501) }, "objectifs")).toBe("500 caractères au maximum.");
  });

  it("changer de mot de passe demande l'actuel", () => {
    const vide = passwordChangeSchema.safeParse({ current: "", password: "nouveaumdp" });
    expect(vide.success ? undefined : vide.error.issues[0].message).toBe("Saisissez votre mot de passe actuel.");
    const court = passwordChangeSchema.safeParse({ current: "ancien", password: "court" });
    expect(court.success ? undefined : court.error.issues[0].message).toBe("Au moins 8 caractères.");
  });
});
