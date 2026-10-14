import { describe, expect, it } from "vitest";
import { analyser, texteBrut, versDocument, versMarkdown, type Bloc } from "@/lib/communaute/mise-en-forme";

// Le texte mis en forme d'une publication (spec mise en forme et vidéo, §2) : un Markdown restreint, lu sans jamais
// produire de HTML, et l'aller-retour avec l'éditeur.

const t = (texte: string, ...marques: ("gras" | "italique" | "souligne" | "barre")[]) => ({ texte, marques });
const para = (...segments: Bloc extends infer B ? (B extends { type: "paragraphe"; segments: infer S } ? S : never) : never) => ({ type: "paragraphe" as const, segments });

describe("Lire le texte", () => {
  it("les marques : gras, italique, souligné, barré, imbriquées", () => {
    expect(analyser("Un **gras**, un _italique_, un ++souligné++ et un ~~barré~~.")).toEqual([
      para(t("Un "), t("gras", "gras"), t(", un "), t("italique", "italique"), t(", un "), t("souligné", "souligne"), t(" et un "), t("barré", "barre"), t(".")),
    ]);
    expect(analyser("**_tout ++ensemble++_**")).toEqual([para(t("tout ", "gras", "italique"), t("ensemble", "gras", "italique", "souligne"))]);
  });

  it("les blocs : titres 1 à 3, listes, citation, paragraphes et retours à la ligne", () => {
    const texte = "# Titre 1\n## Titre 2\n### Titre 3\n\nUne ligne\nla suivante\n\n- un\n- **deux**\n\n3. trois\n4. quatre\n\n> cité\n> encore";
    expect(analyser(texte)).toEqual([
      { type: "titre", niveau: 1, segments: [t("Titre 1")] },
      { type: "titre", niveau: 2, segments: [t("Titre 2")] },
      { type: "titre", niveau: 3, segments: [t("Titre 3")] },
      para(t("Une ligne"), { saut: true }, t("la suivante")),
      { type: "puces", elements: [[t("un")], [t("deux", "gras")]] },
      { type: "numeros", debut: 3, elements: [[t("trois")], [t("quatre")]] },
      { type: "citation", segments: [t("cité"), { saut: true }, t("encore")] },
    ]);
  });

  it("les anciennes publications : « 5 * 3 », « #IA », snake_case, une adresse avec _ restent du texte", () => {
    expect(analyser("5 * 3 = 15 et 2*3*4")).toEqual([para(t("5 * 3 = 15 et 2*3*4"))]);
    expect(analyser("#IA et #Business")).toEqual([para(t("#IA et #Business"))]);
    expect(analyser("mon_fichier_v2 https://exemple.com/a_b_c")).toEqual([para(t("mon_fichier_v2 https://exemple.com/a_b_c"))]);
    expect(analyser("Ligne 1\nLigne 2")).toEqual([para(t("Ligne 1"), { saut: true }, t("Ligne 2"))]);
  });

  it("une marque sans fermeture, ou entourée d'espaces, reste du texte ; \\ protège", () => {
    expect(analyser("**pas fermé")).toEqual([para(t("**pas fermé"))]);
    expect(analyser("a ** b ** c")).toEqual([para(t("a ** b ** c"))]);
    expect(analyser("\\*\\*pas gras\\*\\* et \\# pas un titre")).toEqual([para(t("**pas gras** et # pas un titre"))]);
    expect(analyser("\\# pas un titre")).toEqual([para(t("# pas un titre"))]);
    expect(analyser("C:\\Users\\koffi")).toEqual([para(t("C:\\Users\\koffi"))]);
  });

  it("forgé : des balises restent du texte ; 10 000 marques ne bloquent pas", () => {
    expect(analyser("<script>alert(1)</script> **<b>x</b>**")).toEqual([para(t("<script>alert(1)</script> "), t("<b>x</b>", "gras"))]);
    const debut = performance.now();
    analyser("*".repeat(10_000));
    analyser("**a".repeat(3_000));
    analyser("_".repeat(10_000));
    expect(performance.now() - debut).toBeLessThan(1_000);
  });
});

describe("Le texte sans marques", () => {
  it("pour les extraits et la recherche du premier lien", () => {
    expect(texteBrut("# Live ce soir\n\nRejoignez **https://meet.google.com/abc-defg-hij** à _19 h_\n\n- un\n- deux")).toBe(
      "Live ce soir\nRejoignez https://meet.google.com/abc-defg-hij à 19 h\nun\ndeux",
    );
  });
});

describe("L'aller-retour avec l'éditeur", () => {
  it("document de l'éditeur → texte → document → le même texte", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Live TikTok" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ce soir à " },
            { type: "text", text: "19 h 30", marks: [{ type: "bold" }] },
            { type: "text", text: " avec ", marks: [{ type: "italic" }] },
            { type: "text", text: "Francis", marks: [{ type: "italic" }, { type: "underline" }] },
            { type: "hardBreak" },
            { type: "text", text: "Ancien prix", marks: [{ type: "strike" }] },
          ],
        },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Hooks" }] }] }] },
        { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Idées" }] }] }] },
        { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Le travail paie." }] }] },
        { type: "paragraph" },
      ],
    };
    const texte = versMarkdown(doc);
    expect(texte).toBe("## Live TikTok\n\nCe soir à **19 h 30** _avec ++Francis++_\n~~Ancien prix~~\n\n- Hooks\n\n1. Idées\n\n> Le travail paie.");
    expect(versMarkdown(versDocument(texte))).toBe(texte);
  });

  it("le texte littéral est protégé : *, _, ++, ~~, \\ et les débuts de ligne", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "# pas un titre, 2 ** 3, _cité_, a++b ~~x~~ C:\\*" }] },
        { type: "paragraph", content: [{ type: "text", text: "- pas une liste" }, { type: "hardBreak" }, { type: "text", text: "1. ni ça" }] },
        { type: "paragraph", content: [{ type: "text", text: "> ni une citation" }] },
      ],
    };
    const texte = versMarkdown(doc);
    expect(analyser(texte)).toEqual([
      para(t("# pas un titre, 2 ** 3, _cité_, a++b ~~x~~ C:\\*")),
      para(t("- pas une liste"), { saut: true }, t("1. ni ça")),
      para(t("> ni une citation")),
    ]);
    expect(versMarkdown(versDocument(texte))).toBe(texte);
  });

  it("une ancienne publication s'ouvre dans l'éditeur sans rien perdre", () => {
    const ancien = "Bonjour à tous\nqui a le plan du mémoire ?\n\nMerci 5 * 3";
    expect(versDocument(ancien)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Bonjour à tous" }, { type: "hardBreak" }, { type: "text", text: "qui a le plan du mémoire ?" }] },
        { type: "paragraph", content: [{ type: "text", text: "Merci 5 * 3" }] },
      ],
    });
    expect(texteBrut(versMarkdown(versDocument(ancien)))).toBe("Bonjour à tous\nqui a le plan du mémoire ?\nMerci 5 * 3");
  });

  it("un espace en bord de marque reste dehors ; un document vide donne un texte vide", () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a" }, { type: "text", text: " gras ", marks: [{ type: "bold" }] }, { type: "text", text: "b" }] }] };
    expect(versMarkdown(doc)).toBe("a **gras** b");
    expect(versMarkdown({ type: "doc", content: [{ type: "paragraph" }] })).toBe("");
  });

  it("les adresses restent entières : ni échappées à l'enregistrement, ni lues comme des marques (revue finale)", () => {
    const adresses = [
      "https://fr.wikipedia.org/wiki/Python_(langage)",
      "https://en.wikipedia.org/wiki/C++",
      "https://youtu.be/abcdefghij_",
      "https://www.youtube.com/watch?v=ab_-cdefghi",
      "https://exemple.com/_page_",
    ];
    const texte = versMarkdown({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: adresses.join(" ") }] }] });
    for (const a of adresses) expect(texte).toContain(a);
    expect(analyser(texte)).toEqual([para(t(adresses.join(" ")))]);
    expect(analyser("voir https://exemple.com/_page_ ici")).toEqual([para(t("voir https://exemple.com/_page_ ici"))]);
    expect(analyser("**https://exemple.com/a_b** et _https://exemple.com/c_")).toEqual([
      para(t("https://exemple.com/a_b", "gras"), t(" et "), t("https://exemple.com/c", "italique")),
    ]);
    expect(versMarkdown(versDocument(texte))).toBe(texte);
  });
});

describe("Les liens [texte](https://…)", () => {
  const lien = (texte: string, adresse: string, ...marques: ("gras" | "italique" | "souligne" | "barre")[]) => ({ texte, marques, lien: adresse });

  it("lus : un lien, en gras, sur une partie de mot, avec des parenthèses équilibrées ; deux liens collés", () => {
    expect(analyser("Voir [le programme](https://etudium.bj/programme) ici")).toEqual([para(t("Voir "), lien("le programme", "https://etudium.bj/programme"), t(" ici"))]);
    expect(analyser("**[gras](https://a.com)**")).toEqual([para(lien("gras", "https://a.com", "gras"))]);
    expect(analyser("pré[fixe](https://a.com)")).toEqual([para(t("pré"), lien("fixe", "https://a.com"))]);
    expect(analyser("[Python](https://fr.wikipedia.org/wiki/Python_(langage))")).toEqual([para(lien("Python", "https://fr.wikipedia.org/wiki/Python_(langage)"))]);
    expect(analyser("[a](https://a.com)[b](https://b.com)")).toEqual([para(lien("a", "https://a.com"), lien("b", "https://b.com"))]);
  });

  it("refusés, restent du texte : javascript:, data:, sans adresse web, crochet ou parenthèse non fermés ; les anciens textes à crochets", () => {
    for (const s of ["[x](javascript:alert(1))", "[x](data:text/html,a)", "[x](exemple.com)", "[x](https://a.com", "[x] (https://a.com)", "Voir [1] et [note]"]) {
      expect(analyser(s)).toEqual([para(t(s))]);
    }
    expect(analyser("[[a](https://a.com)](https://b.com)")).toEqual([para(t("["), lien("a", "https://a.com"), t("](https://b.com)"))]);
  });

  it("le texte sans marques garde le texte du lien", () => {
    expect(texteBrut("Voir [le programme](https://etudium.bj/programme) ici")).toBe("Voir le programme ici");
  });

  it("aller-retour avec l'éditeur : un lien, un lien en gras, deux liens collés, des crochets littéraux ; une adresse dangereuse perd son lien", () => {
    const l = (href: string) => ({ type: "link", attrs: { href } });
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Voir " },
            { type: "text", text: "le programme", marks: [l("https://etudium.bj/programme")] },
            { type: "text", text: " et " },
            { type: "text", text: "ceci", marks: [{ type: "bold" }, l("https://a.com")] },
            { type: "text", text: "cela", marks: [l("https://b.com")] },
            { type: "text", text: " [1] " },
            { type: "text", text: "danger", marks: [l("javascript:alert(1)")] },
          ],
        },
      ],
    };
    const texte = versMarkdown(doc);
    expect(texte).toBe("Voir [le programme](https://etudium.bj/programme) et [**ceci**](https://a.com)[cela](https://b.com) \\[1\\] danger");
    expect(versMarkdown(versDocument(texte))).toBe(texte);
    expect(versDocument("[**a**](https://x.com)")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a", marks: [{ type: "bold" }, l("https://x.com")] }] }],
    });
  });
});
