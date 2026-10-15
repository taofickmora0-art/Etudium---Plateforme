import { describe, expect, it } from "vitest";
import { cleLecon, cleModule, deplacementApresDepot, deplacerDans } from "@/lib/admin/rangement";

// Le rangement de l'onglet Leçons (refonte des formations, étape A) : la mise à jour immédiate de l'écran, et la
// traduction d'un glisser-déposer en déplacement (les mêmes règles que la fonction ranger de la 0027).

const programme = () => [
  { id: "m1", lecons: [{ id: "a" }, { id: "b" }, { id: "c" }] },
  { id: "m2", lecons: [{ id: "x" }] },
  { id: "m3", lecons: [] as { id: string }[] },
];
const vue = (p: ReturnType<typeof programme>) => p.map((m) => `${m.id}:${m.lecons.map((l) => l.id).join("")}`);

describe("deplacerDans", () => {
  it("une leçon dans sa section, vers une autre, vers une section vide ; positions bornées", () => {
    expect(vue(deplacerDans(programme(), { type: "lecon", id: "a", module: "m1", position: 3 }))).toEqual(["m1:bca", "m2:x", "m3:"]);
    expect(vue(deplacerDans(programme(), { type: "lecon", id: "b", module: "m2", position: 1 }))).toEqual(["m1:ac", "m2:bx", "m3:"]);
    expect(vue(deplacerDans(programme(), { type: "lecon", id: "c", module: "m3", position: 1 }))).toEqual(["m1:ab", "m2:x", "m3:c"]);
    expect(vue(deplacerDans(programme(), { type: "lecon", id: "a", module: "m2", position: 99 }))).toEqual(["m1:bc", "m2:xa", "m3:"]);
    expect(vue(deplacerDans(programme(), { type: "lecon", id: "a", module: null, position: 2 }))).toEqual(["m1:bac", "m2:x", "m3:"]);
  });

  it("une section ; un élément inconnu ne change rien ; le programme d'origine n'est pas modifié", () => {
    const origine = programme();
    expect(vue(deplacerDans(origine, { type: "module", id: "m3", module: null, position: 1 }))).toEqual(["m3:", "m1:abc", "m2:x"]);
    expect(vue(deplacerDans(origine, { type: "lecon", id: "zz", module: "m2", position: 1 }))).toEqual(vue(programme()));
    expect(vue(origine)).toEqual(vue(programme()));
  });
});

describe("deplacementApresDepot", () => {
  it("une leçon déposée sur une leçon : sa place (vers le bas dans la même section, ou avant elle ailleurs)", () => {
    expect(deplacementApresDepot(programme(), cleLecon("a"), cleLecon("c"))).toEqual({ type: "lecon", id: "a", module: "m1", position: 3 });
    expect(deplacementApresDepot(programme(), cleLecon("c"), cleLecon("a"))).toEqual({ type: "lecon", id: "c", module: "m1", position: 1 });
    expect(deplacementApresDepot(programme(), cleLecon("b"), cleLecon("x"))).toEqual({ type: "lecon", id: "b", module: "m2", position: 1 });
  });

  it("une leçon déposée sur une section : à la fin de celle-ci (même vide) ; sur elle-même ou sa section : rien", () => {
    expect(deplacementApresDepot(programme(), cleLecon("a"), cleModule("m3"))).toEqual({ type: "lecon", id: "a", module: "m3", position: 1 });
    expect(deplacementApresDepot(programme(), cleLecon("a"), cleModule("m2"))).toEqual({ type: "lecon", id: "a", module: "m2", position: 2 });
    expect(deplacementApresDepot(programme(), cleLecon("a"), cleLecon("a"))).toBeNull();
    expect(deplacementApresDepot(programme(), cleLecon("a"), cleModule("m1"))).toBeNull();
  });

  it("une section déposée sur une section, ou sur une de ses leçons", () => {
    expect(deplacementApresDepot(programme(), cleModule("m1"), cleModule("m3"))).toEqual({ type: "module", id: "m1", module: null, position: 3 });
    expect(deplacementApresDepot(programme(), cleModule("m3"), cleLecon("a"))).toEqual({ type: "module", id: "m3", module: null, position: 1 });
    expect(deplacementApresDepot(programme(), cleModule("m2"), cleModule("m2"))).toBeNull();
    expect(deplacementApresDepot(programme(), "inconnu", cleModule("m2"))).toBeNull();
  });
});
