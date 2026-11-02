import { describe, expect, it } from "vitest";
import { filtrer, formationsSuivies } from "@/lib/mes-formations/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { EXCEL, EXCEL_OUVERTE, id, ZOTERO } from "../lecon/donnees";

const ADRESSE = "/formations/maitriser-microsoft-excel/lecons";
/** Ligne de progression : leçon n d'une formation, terminée ou non, vue il y a `ilYa` minutes. */
const ligne = (formationId: string, n: number, terminee: boolean, ilYa: number): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12) - ilYa * 60_000).toISOString(),
  positionSecondes: 0,
});
const publiee = <T extends object>(f: T) => ({ ...f, statut: "publiee" as const });
const ZOTERO_OUVERTE = { ...ZOTERO, id: "zotero", modules: ZOTERO.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) };

describe("Formations suivies", () => {
  it("seules les formations commencées, de la plus récemment ouverte à la plus ancienne", () => {
    const suivies = formationsSuivies(
      [publiee(EXCEL_OUVERTE), publiee(ZOTERO_OUVERTE)],
      [ligne(EXCEL_OUVERTE.id, 1, true, 60), ligne("zotero", 21, false, 5)],
      new Set(),
    );
    expect(suivies.map((s) => s.fiche.slug)).toEqual(["zotero-gerer-ses-references", "maitriser-microsoft-excel"]);
    expect(formationsSuivies([publiee(EXCEL_OUVERTE)], [], new Set())).toEqual([]);
  });

  it("en cours : lien vers la leçon où reprendre, temps restant", () => {
    const [excel] = formationsSuivies([publiee(EXCEL_OUVERTE)], [ligne(EXCEL_OUVERTE.id, 1, true, 20), ligne(EXCEL_OUVERTE.id, 2, false, 10)], new Set([EXCEL_OUVERTE.id]));
    expect(excel).toMatchObject({ etat: "enCours", href: `${ADRESSE}/${id(2)}`, temps: "2 h 14 restantes", favori: true });
    expect(excel.progression.pourcentage).toBe(8);
  });

  it("terminée : temps suivi ; verrouillée si archivée (pas de lien), ou si le reste est fermé", () => {
    const tout = EXCEL_OUVERTE.modules.flatMap((m) => m.lecons).map((l, i) => ({ ...ligne(EXCEL_OUVERTE.id, 1, true, i), leconId: l.id }));
    expect(formationsSuivies([publiee(EXCEL_OUVERTE)], tout, new Set())[0]).toMatchObject({ etat: "terminee", temps: "2 h 20 suivies" });
    const [archivee] = formationsSuivies([{ ...EXCEL_OUVERTE, statut: "archivee" as const }], [ligne(EXCEL_OUVERTE.id, 1, true, 5)], new Set());
    expect(archivee).toMatchObject({ etat: "verrouillee", href: null, temps: "Accès fermé" });
    // Excel sans formule : les deux aperçus vus, tout le reste est fermé.
    const [fermee] = formationsSuivies([publiee(EXCEL)], [ligne(EXCEL.id, 1, true, 20), ligne(EXCEL.id, 2, true, 10)], new Set());
    expect(fermee.etat).toBe("verrouillee");
  });

  it("lot 5 C : désactivée par l'équipe, la carte reste, « Indisponible », sans lien ; l'archivée n'est pas « indisponible »", () => {
    const [desactivee] = formationsSuivies([{ ...EXCEL_OUVERTE, statut: "desactivee" as const }], [ligne(EXCEL_OUVERTE.id, 1, true, 5)], new Set());
    expect(desactivee).toMatchObject({ etat: "verrouillee", href: null, temps: "Momentanément indisponible", indisponible: true });
    const [archivee] = formationsSuivies([{ ...EXCEL_OUVERTE, statut: "archivee" as const }], [ligne(EXCEL_OUVERTE.id, 1, true, 5)], new Set());
    expect(archivee.indisponible).toBe(false);
  });

  it("verrouillée mais encore publiée (aperçus vus) : la carte mène à la fiche, pas nulle part", () => {
    const [fermee] = formationsSuivies([publiee(EXCEL)], [ligne(EXCEL.id, 1, true, 20), ligne(EXCEL.id, 2, true, 10)], new Set());
    expect(fermee).toMatchObject({ etat: "verrouillee", href: "/formations/maitriser-microsoft-excel", temps: "Accès fermé" });
  });

  it("filtres : « En cours » compte les formations à 0 % ; « Favoris » parmi les suivies", () => {
    const suivies = formationsSuivies(
      [publiee(EXCEL_OUVERTE), publiee(ZOTERO_OUVERTE)],
      [ligne(EXCEL_OUVERTE.id, 1, false, 20), ligne("zotero", 21, true, 10), ligne("zotero", 22, true, 9)],
      new Set(["zotero"]),
    );
    expect(filtrer(suivies, "enCours").map((s) => s.fiche.id)).toEqual([EXCEL_OUVERTE.id]);
    expect(suivies.find((s) => s.fiche.id === EXCEL_OUVERTE.id)?.progression.pourcentage).toBe(0);
    expect(filtrer(suivies, "terminees").map((s) => s.fiche.id)).toEqual(["zotero"]);
    expect(filtrer(suivies, "verrouillees")).toEqual([]);
    expect(filtrer(suivies, "favoris").map((s) => s.fiche.id)).toEqual(["zotero"]);
    expect(filtrer(suivies, "toutes")).toHaveLength(2);
  });
});

describe("Formations suivies : l'inscription (0069 ; spec du 2 novembre 2026, §2)", () => {
  const inscription = (formationId: string, inscritLe: string) => ({ formationId, inscritLe });

  it("inscrite sans leçon ouverte : « à moi » à 0 %, elle mène à la première leçon ouverte et se classe à sa date d'inscription", () => {
    const suivies = formationsSuivies(
      [publiee(EXCEL_OUVERTE), publiee(ZOTERO_OUVERTE)],
      [ligne(EXCEL_OUVERTE.id, 1, true, 60)],
      new Set(["zotero"]),
      [inscription("zotero", "2026-10-13T12:30:00Z"), inscription(EXCEL_OUVERTE.id, "2026-10-01T10:00:00Z")],
    );
    expect(suivies.map((s) => s.fiche.id)).toEqual(["zotero", EXCEL_OUVERTE.id]);
    const [zotero] = suivies;
    expect(zotero).toMatchObject({
      etat: "enCours",
      href: `/formations/zotero-gerer-ses-references/lecons/${id(21)}`,
      temps: "15 min restantes",
      favori: true,
      derniereVisite: "2026-10-13T12:30:00Z",
    });
    expect(zotero.progression.pourcentage).toBe(0);
    expect(filtrer(suivies, "enCours").map((s) => s.fiche.id)).toContain("zotero");
  });

  it("inscrite, rien d'ouvert (abonnement échu, sans aperçu) : verrouillée, la carte mène à la fiche", () => {
    const [zotero] = formationsSuivies([publiee({ ...ZOTERO, id: "zotero" })], [], new Set(), [inscription("zotero", "2026-10-13T12:30:00Z")]);
    expect(zotero).toMatchObject({ etat: "verrouillee", href: "/formations/zotero-gerer-ses-references", temps: "Accès fermé" });
  });

  it("une formation commencée n'est comptée qu'une fois ; une inscription sans fiche lisible est ignorée ; sans inscription, rien ne change", () => {
    const lignes = [ligne(EXCEL_OUVERTE.id, 1, true, 60)];
    const avec = formationsSuivies([publiee(EXCEL_OUVERTE)], lignes, new Set(), [inscription(EXCEL_OUVERTE.id, "2026-10-01T10:00:00Z"), inscription("inconnue", "2026-10-02T10:00:00Z")]);
    expect(avec.map((s) => s.fiche.id)).toEqual([EXCEL_OUVERTE.id]);
    expect(avec).toEqual(formationsSuivies([publiee(EXCEL_OUVERTE)], lignes, new Set()));
    expect(formationsSuivies([publiee(ZOTERO_OUVERTE)], [], new Set())).toEqual([]);
  });
});
