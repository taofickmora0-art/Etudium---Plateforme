import { createHmac, timingSafeEqual } from "node:crypto";

// Les notifications de Payiz sont signées (en-tête « Payiz-Signature: t=…,v1=… ») : HMAC-SHA256, en hexadécimal, de
// « t.corps brut » avec le secret de l'adresse déclarée. On refuse une signature de plus de 5 minutes.

export const TOLERANCE_SIGNATURE_S = 300;

/** Vrai si l'une des empreintes `v1` correspond au corps brut, et que l'horodatage a moins de 5 minutes. */
export function verifierSignature(corps: string, entete: string | null, secret: string, maintenant = Date.now()): boolean {
  if (!entete || !secret) return false;
  let t: number | null = null;
  const empreintes: string[] = [];
  for (const morceau of entete.split(",")) {
    const egal = morceau.indexOf("=");
    if (egal < 0) continue;
    const cle = morceau.slice(0, egal).trim();
    const valeur = morceau.slice(egal + 1).trim();
    if (cle === "t" && /^\d+$/.test(valeur)) t = Number(valeur);
    else if (cle === "v1" && /^[0-9a-f]{64}$/i.test(valeur)) empreintes.push(valeur.toLowerCase());
  }
  if (t === null || empreintes.length === 0) return false;
  if (Math.abs(maintenant / 1000 - t) > TOLERANCE_SIGNATURE_S) return false;
  const attendue = Buffer.from(createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex"), "utf8");
  return empreintes.some((v) => {
    const recue = Buffer.from(v, "utf8");
    return recue.length === attendue.length && timingSafeEqual(recue, attendue);
  });
}
