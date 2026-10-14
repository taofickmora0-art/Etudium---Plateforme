import { describe, expect, it } from "vitest";
import { apercuVisio, decouperLiens, domaine, idYoutube, premiereAdresse } from "@/lib/communaute/liens";

// Les liens d'une publication (spec du fil Actualités, §3) : règles pures, utilisées aussi par les écrans.

describe("Liens", () => {
  it("premiereAdresse : la première adresse web, sans la ponctuation qui la suit", () => {
    expect(premiereAdresse("Voir https://exemple.com/page.")).toBe("https://exemple.com/page");
    expect(premiereAdresse("(lien : https://a.com/x) et http://b.com")).toBe("https://a.com/x");
    expect(premiereAdresse("Rejoignez-nous ici : https://meet.google.com/coj-aymk-rwe !")).toBe("https://meet.google.com/coj-aymk-rwe");
    expect(premiereAdresse("Rien ici, ni ftp://a.com")).toBeNull();
    expect(premiereAdresse("https://a.com/recherche?q=1&page=2, voilà")).toBe("https://a.com/recherche?q=1&page=2");
  });

  it("idYoutube : watch, youtu.be, shorts, embed, m. ; pas un autre site ni un faux identifiant", () => {
    expect(idYoutube("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12")).toBe("dQw4w9WgXcQ");
    expect(idYoutube("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
    expect(idYoutube("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(idYoutube("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(idYoutube("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(idYoutube("https://www.youtube.com/watch?v=court")).toBeNull();
    expect(idYoutube("https://exemple.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(idYoutube("pas une adresse")).toBeNull();
  });

  it("decouperLiens : le texte et ses liens, la ponctuation reste dans le texte", () => {
    expect(decouperLiens("Voir https://a.com/x, puis https://b.com.")).toEqual([
      { texte: "Voir " },
      { lien: "https://a.com/x" },
      { texte: ", puis " },
      { lien: "https://b.com" },
      { texte: "." },
    ]);
    expect(decouperLiens("Sans lien")).toEqual([{ texte: "Sans lien" }]);
  });

  it("domaine : tiré de l'adresse, sans « www. »", () => {
    expect(domaine("https://www.meet.google.com/abc")).toBe("meet.google.com");
    expect(domaine("https://zoom.us/j/123")).toBe("zoom.us");
    expect(domaine("pas une adresse")).toBe("");
  });
});

describe("L'aperçu d'un lien de visioconférence (Google Meet, Zoom)", () => {
  it("une carte reconnaissable, sans lire la page", () => {
    expect(apercuVisio("https://meet.google.com/coj-aymk-rwe")).toEqual({
      type: "lien",
      url: "https://meet.google.com/coj-aymk-rwe",
      titre: "Google Meet",
      description: "Réunion en ligne sur Google Meet : rejoignez-la depuis ce lien.",
      image: null,
    });
    expect(apercuVisio("https://us02web.zoom.us/j/123456?pwd=x")).toMatchObject({ titre: "Zoom" });
    expect(apercuVisio("https://teams.microsoft.com/l/meetup-join/x")).toMatchObject({ titre: "Microsoft Teams" });
  });

  it("un autre site : rien", () => {
    expect(apercuVisio("https://etudium.bj/programme")).toBeNull();
    expect(apercuVisio("https://meet.google.com.ailleurs.com/x")).toBeNull();
  });
});
