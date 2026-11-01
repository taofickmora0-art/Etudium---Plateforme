import { describe, expect, it } from "vitest";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import {
  ajouterMois,
  dateLongue,
  dureeAbonnement,
  etapeDepuisCarte,
  formuleDuCompte,
  joursRestants,
  libelleMoyen,
  libelleStatut,
  montantFcfa,
  periodeSouscription,
} from "@/lib/abonnement/regles";
import { carteSql } from "./fixtures";

// Les règles des abonnements (lot 2) : montants, dates à l'heure du Bénin, durées qui s'ajoutent, étapes du paiement.

const carte = (champs: Record<string, unknown> = {}) => versCartePaiement(carteSql(champs));

describe("Montants, durées et dates", () => {
  it("les montants en FCFA", () => {
    expect(montantFcfa(15000)).toBe("15 000 FCFA");
    expect(montantFcfa(0)).toBe("0 FCFA");
  });

  it("les durées", () => {
    expect([3, 6, 12].map(dureeAbonnement)).toEqual(["3 mois", "6 mois", "1 an"]);
  });

  it("les dates longues, à l'heure du Bénin", () => {
    expect(dateLongue("2027-05-01T10:00:00Z")).toBe("1er mai 2027");
    expect(dateLongue("2027-03-14T10:00:00Z")).toBe("14 mars 2027");
    // 23 h 30 à Paris le 30 avril (UTC) : déjà le 1er mai au Bénin.
    expect(dateLongue("2027-04-30T23:30:00Z")).toBe("1er mai 2027");
  });

  it("ajouter des mois comme la base : à l'heure du Bénin, ramené au dernier jour du mois", () => {
    expect(ajouterMois("2026-08-30T23:00:00Z", 6)).toBe("2027-02-27T23:00:00.000Z");
    expect(ajouterMois("2026-11-01T09:00:00Z", 6)).toBe("2027-05-01T09:00:00.000Z");
    expect(ajouterMois("2026-11-01T09:00:00Z", 12)).toBe("2027-11-01T09:00:00.000Z");
  });

  it("la période d'un nouvel abonnement : à la suite de celui en cours, sinon tout de suite", () => {
    const maintenant = new Date("2026-11-01T09:00:00Z");
    expect(periodeSouscription(maintenant, { etat: "gratuit" }, 6)).toEqual({ debut: "2026-11-01T09:00:00.000Z", fin: "2027-05-01T09:00:00.000Z" });
    const expire = { etat: "expire" as const, formule: { code: "basique" as const, nom: "Basique" }, fin: "2026-10-01T09:00:00Z" };
    expect(periodeSouscription(maintenant, expire, 3).debut).toBe("2026-11-01T09:00:00.000Z");
    const actif = { etat: "actif" as const, formule: { code: "standard" as const, nom: "Standard" }, fin: "2027-01-10T12:00:00Z" };
    expect(periodeSouscription(maintenant, actif, 3)).toEqual({ debut: "2027-01-10T12:00:00.000Z", fin: "2027-04-10T12:00:00.000Z" });
  });

  it("les jours restants, arrondis au jour supérieur", () => {
    expect(joursRestants("2026-11-06T09:00:00Z", new Date("2026-11-01T10:00:00Z"))).toBe(5);
    expect(joursRestants("2026-11-01T11:00:00Z", new Date("2026-11-01T10:00:00Z"))).toBe(1);
    expect(joursRestants("2026-11-01T09:00:00Z", new Date("2026-11-01T10:00:00Z"))).toBe(0);
  });
});

describe("Libellés", () => {
  it("le statut d'un paiement", () => {
    expect(libelleStatut("reussi")).toEqual({ libelle: "Réussi", ton: "reussi" });
    expect(libelleStatut("en_attente")).toEqual({ libelle: "En attente", ton: "enAttente" });
    expect(libelleStatut("echoue")).toEqual({ libelle: "Échoué", ton: "echoue" });
    expect(libelleStatut("expire")).toEqual({ libelle: "Expiré", ton: "enAttente" });
    expect(libelleStatut("annule")).toEqual({ libelle: "Annulé", ton: "enAttente" });
  });

  it("le moyen de paiement", () => {
    expect(libelleMoyen(carte({ operateur: "mtn" }))).toBe("MTN Mobile Money");
    expect(libelleMoyen(carte({ operateur: "moov" }))).toBe("Moov Money");
    expect(libelleMoyen(carte({ montant: 0, operateur: null }))).toBe("Offert");
    // Attribué à la main au back-office (0054).
    expect(libelleMoyen(carte({ source: "manuel", moyen_manuel: "mobile_money" }))).toBe("Mobile Money hors plateforme");
    expect(libelleMoyen(carte({ source: "manuel", moyen_manuel: "especes" }))).toBe("Espèces");
    expect(libelleMoyen(carte({ source: "manuel", moyen_manuel: "virement" }))).toBe("Virement");
    expect(libelleMoyen(carte({ source: "manuel", moyen_manuel: "offert", montant: 0 }))).toBe("Offert");
  });

  it("la formule du profil", () => {
    expect(formuleDuCompte({ etat: "actif", formule: { code: "standard", nom: "Standard" }, fin: "2027-05-01T09:00:00Z" })).toBe("Standard");
    expect(formuleDuCompte({ etat: "expire", formule: { code: "standard", nom: "Standard" }, fin: "2026-05-01T09:00:00Z" })).toBe("Gratuite");
    expect(formuleDuCompte({ etat: "gratuit" })).toBe("Gratuite");
  });
});

describe("L'étape d'un paiement", () => {
  it("attente : 3 minutes depuis le dernier essai", () => {
    expect(etapeDepuisCarte(carte({ essai_le: "2026-11-01T10:00:00Z" }))).toMatchObject({ etat: "attente", finAttente: "2026-11-01T10:03:00.000Z" });
    expect(etapeDepuisCarte(carte())).toMatchObject({ etat: "attente", finAttente: "2026-11-01T10:03:00.000Z" });
  });

  it("réussi, échoué (avec son motif en clair), expiré ou annulé", () => {
    expect(etapeDepuisCarte(carte({ statut: "reussi" })).etat).toBe("reussi");
    expect(etapeDepuisCarte(carte({ statut: "echoue", motif_echec: "insufficient_funds" }))).toMatchObject({
      etat: "echoue",
      message: "Votre solde Mobile Money est insuffisant. Rechargez puis réessayez.",
    });
    expect(etapeDepuisCarte(carte({ statut: "expire" })).etat).toBe("expire");
    expect(etapeDepuisCarte(carte({ statut: "annule" })).etat).toBe("expire");
  });
});
