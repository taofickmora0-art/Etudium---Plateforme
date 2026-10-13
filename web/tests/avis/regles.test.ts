import { describe, expect, it } from "vitest";
import { COMMENTAIRE_MAX, formatNote, libelleNombreAvis, peutDonnerAvis, pourcentages, resumeDepuis, toneAvatar } from "@/lib/avis/regles";
import type { EtatProgression } from "@/lib/progression/regles";

const etat = (faites: number, total: number): EtatProgression => ({
  pourcentage: total ? Math.round((100 * faites) / total) : 0,
  terminees: new Set(Array.from({ length: faites }, (_, i) => `l${i}`)),
  total,
  restantSecondes: 0,
  aReprendre: null,
  commencee: faites > 0,
  terminee: total > 0 && faites === total,
});
const vide = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

describe("Avis : règles", () => {
  it("un avis à partir de 50 % pile (6 leçons sur 12), sans arrondi", () => {
    expect(peutDonnerAvis(etat(6, 12))).toBe(true);
    expect(peutDonnerAvis(etat(5, 12))).toBe(false);
    // 5 sur 11 = 45 %, 6 sur 11 = 54,5 % ; 5,5 n'existe pas : jamais d'avis à 49,5 % arrondi à 50.
    expect(peutDonnerAvis(etat(5, 11))).toBe(false);
    expect(peutDonnerAvis(etat(0, 0))).toBe(false);
    expect(COMMENTAIRE_MAX).toBe(1000);
  });

  it("le résumé : moyenne au dixième et nombre d'avis ; sans avis, pas de moyenne", () => {
    expect(resumeDepuis({ ...vide, 5: 3, 4: 1 })).toEqual({ moyenne: 4.8, total: 4, repartition: { ...vide, 5: 3, 4: 1 } });
    expect(resumeDepuis(vide)).toEqual({ moyenne: null, total: 0, repartition: vide });
  });

  it("les pourcentages de la répartition totalisent toujours 100", () => {
    expect(pourcentages(resumeDepuis({ ...vide, 5: 1, 4: 1, 3: 1 }))).toEqual({ 5: 34, 4: 33, 3: 33, 2: 0, 1: 0 });
    const design = pourcentages(resumeDepuis({ ...vide, 5: 103, 4: 17, 3: 5, 2: 1 }));
    expect(Object.values(design).reduce((a, b) => a + b, 0)).toBe(100);
    expect(design[5]).toBe(82);
    expect(pourcentages(resumeDepuis(vide))).toEqual(vide);
  });

  it("formats : « 4,8 », « 1 avis », ton d'avatar stable", () => {
    expect(formatNote(4.8)).toBe("4,8");
    expect(formatNote(5)).toBe("5,0");
    expect(libelleNombreAvis(1)).toBe("1 avis");
    expect(libelleNombreAvis(126)).toBe("126 avis");
    const ton = toneAvatar("8c2f1a3e-0000-4000-8000-000000000001");
    expect(["bleu", "violet", "ambre"]).toContain(ton);
    expect(toneAvatar("8c2f1a3e-0000-4000-8000-000000000001")).toBe(ton);
  });
});
