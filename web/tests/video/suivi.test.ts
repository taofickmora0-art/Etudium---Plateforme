import { describe, expect, it } from "vitest";
import { ajouter, depuisMultirange, fusionner, observer, pourcentageVu, total, versMultirange, type EtatSuivi } from "@/lib/video/suivi";

const lecture = { vitesse: 1, enLecture: true };

describe("Passages regardés", () => {
  it("se fusionnent, dans n'importe quel ordre, contigus compris", () => {
    expect(fusionner([[5, 10], [0, 3], [3, 4], [9, 12]])).toEqual([
      [0, 4],
      [5, 12],
    ]);
    expect(ajouter([[0, 10]], [5, 20])).toEqual([[0, 20]]);
    expect(ajouter([[0, 10]], [30, 40])).toEqual([
      [0, 10],
      [30, 40],
    ]);
  });

  it("se comptent en secondes", () => {
    expect(total([[0, 4], [5, 12]])).toBe(11);
    expect(total([])).toBe(0);
  });

  it("s'écrivent et se relisent comme un multirange Postgres (secondes entières)", () => {
    expect(versMultirange([[0, 40.9], [60, 90]])).toBe("{[0,40),[60,90)}");
    expect(versMultirange([[1.2, 1.8]])).toBe("{}");
    expect(versMultirange([])).toBe("{}");
    expect(depuisMultirange("{[0,40),[60,90)}")).toEqual([
      [0, 40],
      [60, 90],
    ]);
    expect(depuisMultirange("{}")).toEqual([]);
    expect(depuisMultirange("n'importe quoi")).toEqual([]);
  });

  it("donnent un pourcentage de la durée de référence", () => {
    expect(pourcentageVu([[0, 40]], 370)).toBe(11);
    expect(pourcentageVu([[0, 400]], 370)).toBe(100);
    expect(pourcentageVu([[0, 40]], 0)).toBe(0);
  });
});

describe("Observation de la lecture", () => {
  const depart: EtatSuivi = { position: 10, instant: 0, passages: [] };

  it("une seconde de lecture compte une seconde", () => {
    expect(observer(depart, { ...lecture, position: 11, instant: 1000 }).passages).toEqual([[10, 11]]);
  });

  it("un saut dans la barre ne compte pas", () => {
    const apres = observer(depart, { ...lecture, position: 310, instant: 1000 });
    expect(apres.passages).toEqual([]);
    expect(apres.position).toBe(310);
  });

  it("en vitesse 2×, deux secondes de vidéo par seconde comptent", () => {
    expect(observer(depart, { position: 12, instant: 1000, vitesse: 2, enLecture: true }).passages).toEqual([[10, 12]]);
  });

  it("en pause, un retour en arrière, ou à la première observation : rien ne compte", () => {
    expect(observer(depart, { position: 11, instant: 1000, vitesse: 1, enLecture: false }).passages).toEqual([]);
    expect(observer(depart, { ...lecture, position: 5, instant: 1000 }).passages).toEqual([]);
    expect(observer({ position: null, instant: 0, passages: [] }, { ...lecture, position: 50, instant: 1000 })).toEqual({ position: 50, instant: 1000, passages: [] });
  });
});
