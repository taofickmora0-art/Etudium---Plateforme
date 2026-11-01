import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifierSignature } from "@/lib/paiements/signature";

// Les notifications de Payiz : HMAC-SHA256 hexadécimal de « t.corps », refusé au-delà de 5 minutes.

const SECRET = "whsec_test";
const CORPS = '{"id":"evt_1","type":"payment.succeeded"}';
const MAINTENANT = 1_790_000_000_000;
const t = Math.floor(MAINTENANT / 1000);
const signer = (horodatage: number, secret = SECRET, corps = CORPS) => createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex");

describe("La signature des notifications Payiz", () => {
  it("acceptée quand elle est juste et récente", () => {
    expect(verifierSignature(CORPS, `t=${t},v1=${signer(t)}`, SECRET, MAINTENANT)).toBe(true);
    expect(verifierSignature(CORPS, `t=${t},v1=${"0".repeat(64)},v1=${signer(t)}`, SECRET, MAINTENANT)).toBe(true);
  });

  it("refusée avec un autre secret ou un corps modifié", () => {
    expect(verifierSignature(CORPS, `t=${t},v1=${signer(t, "autre")}`, SECRET, MAINTENANT)).toBe(false);
    expect(verifierSignature(`${CORPS} `, `t=${t},v1=${signer(t)}`, SECRET, MAINTENANT)).toBe(false);
  });

  it("refusée au-delà de 5 minutes", () => {
    const vieux = t - 301;
    expect(verifierSignature(CORPS, `t=${vieux},v1=${signer(vieux)}`, SECRET, MAINTENANT)).toBe(false);
    const limite = t - 300;
    expect(verifierSignature(CORPS, `t=${limite},v1=${signer(limite)}`, SECRET, MAINTENANT)).toBe(true);
  });

  it("refusée si l'en-tête manque ou est mal formé", () => {
    for (const entete of [null, "", "v1=abc", `t=${t}`, `t=abc,v1=${signer(t)}`, `t=${t},v1=zz`]) {
      expect(verifierSignature(CORPS, entete, SECRET, MAINTENANT)).toBe(false);
    }
  });
});
