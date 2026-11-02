import { describe, expect, it } from "vitest";
import {
  cheminsImages,
  depuisMarkdown,
  documentVide,
  texteDuDocument,
  validerDocument,
  type DocumentLecon,
  type NoeudDoc,
} from "@/lib/lecon/document";

// Le format du contenu riche d'une leçon (fin du lot 4, spec §1.1) : une liste fermée de blocs et de marques, vérifiée
// par le serveur ; des limites ; le texte brut ; la conversion du Markdown restreint des leçons anciennes.

const F = "11111111-1111-4111-8111-111111111111";
const I = "22222222-2222-4222-8222-222222222222";
const texte = (t: string, marks?: NoeudDoc["marks"]): NoeudDoc => ({ type: "text", text: t, ...(marks ? { marks } : {}) });
const para = (...c: NoeudDoc[]): NoeudDoc => ({ type: "paragraph", content: c });
const cellule = (type: "tableHeader" | "tableCell", t: string): NoeudDoc => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [para(texte(t))] });
const tableau = (lignes: [string, string][], entete = true): NoeudDoc => ({
  type: "table",
  content: lignes.map((l, i) => ({ type: "tableRow", content: l.map((t) => cellule(entete && i === 0 ? "tableHeader" : "tableCell", t)) })),
});
const image = (chemin = `${F}/${I}.webp`): NoeudDoc => ({ type: "imageLecon", attrs: { chemin, alt: "Capture", legende: "La fenêtre" } });
const doc = (...content: NoeudDoc[]): DocumentLecon => ({ type: "doc", content });
const refus = (d: unknown) => {
  const r = validerDocument(d);
  return r.ok ? null : r.message;
};
const INCONNU = "Le contenu contient un élément non reconnu.";

const COMPLET = doc(
  { type: "heading", attrs: { level: 2 }, content: [texte("Titre")] },
  { type: "heading", attrs: { level: 3 }, content: [texte("Sous-titre")] },
  para(
    texte("gras", [{ type: "bold" }]),
    texte(" italique", [{ type: "italic" }]),
    texte(" souligné", [{ type: "underline" }]),
    texte(" barré", [{ type: "strike" }]),
    { type: "hardBreak" },
    texte("lien", [{ type: "link", attrs: { href: "https://etudium.com" } }]),
  ),
  { type: "bulletList", content: [{ type: "listItem", content: [para(texte("un"))] }] },
  { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [para(texte("trois"))] }] },
  { type: "blockquote", content: [para(texte("citation"))] },
  { type: "encadre", attrs: { ton: "astuce" }, content: [para(texte("Astuce")), { type: "bulletList", content: [{ type: "listItem", content: [para(texte("x"))] }] }] },
  image(),
  tableau([["A", "B"], ["C", "D"]]),
  { type: "videoLecon", attrs: { fournisseur: "youtube", id: "dQw4w9WgXcQ" } },
  { type: "horizontalRule" },
);

describe("Valider un document", () => {
  it("un document de chaque bloc est accepté tel quel", () => {
    const r = validerDocument(COMPLET);
    expect(r).toEqual({ ok: true, document: COMPLET });
  });

  it("les attributs que l'éditeur ajoute de lui-même (cible du lien, type de liste) sont retirés", () => {
    const r = validerDocument(
      doc(
        para(texte("lien", [{ type: "link", attrs: { href: "https://a.fr", target: "_blank", rel: "noopener nofollow ugc", class: null, title: null } } as never])),
        { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [para(texte("un"))] }] },
        { type: "table", content: [{ type: "tableRow", content: [{ ...cellule("tableCell", "A"), attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null } }] }] },
      ),
    );
    expect(r).toEqual({
      ok: true,
      document: doc(
        para(texte("lien", [{ type: "link", attrs: { href: "https://a.fr" } }])),
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [para(texte("un"))] }] },
        { type: "table", content: [{ type: "tableRow", content: [cellule("tableCell", "A")] }] },
      ),
    });
  });

  it("un bloc inconnu, une marque inconnue ou un attribut en trop sont refusés", () => {
    expect(refus(doc({ type: "codeBlock", content: [texte("x")] }))).toBe(INCONNU);
    expect(refus(doc(para(texte("x", [{ type: "textStyle" } as never]))))).toBe(INCONNU);
    expect(refus(doc({ type: "heading", attrs: { level: 1 }, content: [texte("x")] }))).toBe(INCONNU);
    expect(refus(doc({ type: "paragraph", attrs: { style: "color:red" }, content: [texte("x")] }))).toBe(INCONNU);
    expect(refus(doc({ type: "encadre", attrs: { ton: "rouge" }, content: [para(texte("x"))] }))).toBe(INCONNU);
    // Un tableau dans un tableau, une image dans une liste : refusés.
    expect(refus(doc({ type: "table", content: [{ type: "tableRow", content: [{ ...cellule("tableCell", "x"), content: [tableau([["a", "b"]])] }] }] }))).toBe(INCONNU);
    expect(refus(doc({ type: "bulletList", content: [{ type: "listItem", content: [image()] }] }))).toBe(INCONNU);
    expect(refus({ type: "doc" })).toBe(INCONNU);
    expect(refus("texte")).toBe(INCONNU);
  });

  it("relecture finale : cellules fusionnées acceptées (1 à 20), largeur de colonne retirée", () => {
    const fusion: NoeudDoc = { type: "tableCell", attrs: { colspan: 2, rowspan: 1, colwidth: [301, 120] }, content: [para(texte("Total"))] };
    const r = validerDocument(doc({ type: "table", content: [{ type: "tableRow", content: [fusion] }] }));
    expect(r).toEqual({
      ok: true,
      document: doc({ type: "table", content: [{ type: "tableRow", content: [{ ...fusion, attrs: { colspan: 2, rowspan: 1, colwidth: null } }] }] }),
    });
    expect(refus(doc({ type: "table", content: [{ type: "tableRow", content: [{ ...fusion, attrs: { colspan: 21, rowspan: 1, colwidth: null } }] }] }))).toBe(INCONNU);
    expect(refus(doc({ type: "table", content: [{ type: "tableRow", content: [{ ...fusion, attrs: { colspan: 1, rowspan: 1, colwidth: "large" } }] }] }))).toBe(INCONNU);
  });

  it("un lien javascript: est refusé", () => {
    expect(refus(doc(para(texte("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))))).toBe("Un lien doit commencer par http:// ou https://.");
  });

  it("une image collée (data:) ou hors de l'espace est refusée", () => {
    expect(refus(doc(image("data:image/png;base64,AAAA")))).toBe(INCONNU);
    expect(refus(doc(image("../x.png")))).toBe(INCONNU);
    expect(refus(doc(image(`${F}/${I}.gif`)))).toBe(INCONNU);
  });

  it("une vidéo d'une plateforme inconnue est refusée", () => {
    expect(refus(doc({ type: "videoLecon", attrs: { fournisseur: "dailymotion", id: "x" } }))).toBe(INCONNU);
  });

  it("l'identifiant d'une vidéo suit le format de sa plateforme (comme la vidéo de la leçon)", () => {
    const VIDEO = "Une vidéo du contenu n’a pas un identifiant valide : ajoutez-la de nouveau.";
    expect(refus(doc({ type: "videoLecon", attrs: { fournisseur: "youtube", id: "../../embed?x=1" } }))).toBe(VIDEO);
    expect(refus(doc({ type: "videoLecon", attrs: { fournisseur: "vimeo", id: "dQw4w9WgXcQ" } }))).toBe(VIDEO);
    expect(validerDocument(doc({ type: "videoLecon", attrs: { fournisseur: "vimeo", id: "76979871/abcdef0123" } })).ok).toBe(true);
  });

  it("les limites", () => {
    expect(refus(doc(para(texte("a".repeat(20_001)))))).toBe("Le texte dépasse 20 000 caractères.");
    expect(refus(doc(...Array.from({ length: 41 }, () => image())))).toBe("40 images au plus par leçon.");
    expect(refus(doc(...Array.from({ length: 11 }, () => tableau([["a", "b"]]))))).toBe("10 tableaux au plus par leçon.");
    // Beaucoup de blocs vides : peu de texte, mais un document trop lourd.
    expect(refus(doc(...Array.from({ length: 12_000 }, () => ({ type: "horizontalRule" }))))).toBe("Le contenu est trop lourd (300 Ko au plus).");
    // Mesuré comme la base (le texte du jsonb, une espace après chaque « : » et chaque « , ») : 11 500 blocs font moins
    // de 300 Ko en JSON compact, mais plus pour la base ; l'appli refuse aussi, au lieu d'un échec à l'enregistrement.
    expect(refus(doc(...Array.from({ length: 11_500 }, () => ({ type: "horizontalRule" }))))).toBe("Le contenu est trop lourd (300 Ko au plus).");
  });
});

describe("Autour du document", () => {
  it("texte brut : un bloc par ligne, les cellules séparées par une tabulation", () => {
    expect(texteDuDocument(doc({ type: "heading", attrs: { level: 2 }, content: [texte("Titre")] }, para(texte("Texte")), tableau([["A", "B"], ["C", "D"]])))).toBe(
      "Titre\nTexte\nA\tB\nC\tD",
    );
  });

  it("depuis le Markdown ancien : un titre de niveau 1 devient un titre de niveau 2", () => {
    const d = depuisMarkdown("# Titre\n\n**gras**");
    expect(d.content[0]).toMatchObject({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titre" }] });
    expect(d.content[1]).toMatchObject({ type: "paragraph", content: [{ type: "text", text: "gras", marks: [{ type: "bold" }] }] });
    expect(validerDocument(d).ok).toBe(true);
    expect(depuisMarkdown("")).toEqual(doc({ type: "paragraph" }));
  });

  it("chemins des images et document vide", () => {
    expect(cheminsImages(COMPLET)).toEqual([`${F}/${I}.webp`]);
    expect(documentVide(doc({ type: "paragraph" }))).toBe(true);
    expect(documentVide(doc(image()))).toBe(false);
    expect(documentVide(COMPLET)).toBe(false);
  });
});
