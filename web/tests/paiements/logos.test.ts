import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { logoOperateur } from "@/lib/paiements/logos";

// Les logos des opérateurs, hébergés avec le site (13 novembre 2026, repris de flashSMS) : quand le prestataire n'en
// donne pas (SasPay n'en donne aucun, Payiz pas pour Celtiis). La marque se lit au début du code.

describe("Le logo d'un opérateur", () => {
  it("d'après la marque du code, chez Payiz comme chez SasPay ; l'ordre compte (Tigo Tanzanie est devenu Yas)", () => {
    expect(logoOperateur("celtiis")).toBe("/logos/mobile-money/celtiis-cash.svg");
    expect(logoOperateur("celtiis_bj")).toBe("/logos/mobile-money/celtiis-cash.svg");
    expect(logoOperateur("orange_ci")).toBe("/logos/mobile-money/orange-money.svg");
    expect(logoOperateur("wave_sn")).toBe("/logos/mobile-money/wave.svg");
    expect(logoOperateur("vodacom_cd")).toBe("/logos/mobile-money/m-pesa.svg");
    expect(logoOperateur("tigo_tz")).toBe("/logos/mobile-money/yas.svg");
    expect(logoOperateur("tigo_gh")).toBe("/logos/mobile-money/tigo.svg");
    expect(logoOperateur("inconnu")).toBeNull();
  });

  it("chaque fichier existe dans public", () => {
    for (const code of ["mtn", "moov", "celtiis", "orange", "wave", "airtel", "mpesa", "halopesa", "togocel", "freemoney", "vodafone", "tnm", "zamtel", "tigo_tz", "tigo_gh"]) {
      expect(existsSync(join(process.cwd(), "public", logoOperateur(code)!)), code).toBe(true);
    }
  });
});
