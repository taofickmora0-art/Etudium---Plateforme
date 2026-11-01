// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentLecon } from "@/components/lecon/DocumentLecon";
import type { DocumentLecon as Doc, NoeudDoc } from "@/lib/lecon/document";

// L'affichage du contenu riche (fin du lot 4, spec §1.3) : chaque bloc avec son élément, aux couleurs de la charte ;
// rien d'autre que la liste fermée.

const F = "11111111-1111-4111-8111-111111111111";
const IMG = `${F}/22222222-2222-4222-8222-222222222222.webp`;
const t = (text: string, marks?: NoeudDoc["marks"]): NoeudDoc => ({ type: "text", text, ...(marks ? { marks } : {}) });
const p = (...c: NoeudDoc[]): NoeudDoc => ({ type: "paragraph", content: c });
const cell = (type: string, x: string): NoeudDoc => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [p(t(x))] });
const doc = (...content: NoeudDoc[]): Doc => ({ type: "doc", content });

describe("Afficher le document d'une leçon", () => {
  it("chaque bloc avec son élément", () => {
    render(
      <DocumentLecon
        images={{ [IMG]: "https://stockage.exemple/signe.webp" }}
        document={doc(
          { type: "heading", attrs: { level: 2 }, content: [t("Importer")] },
          { type: "heading", attrs: { level: 3 }, content: [t("Depuis Excel")] },
          p(t("gras", [{ type: "bold" }]), t(" et "), t("le site", [{ type: "link", attrs: { href: "https://etudium.com" } }])),
          { type: "bulletList", content: [{ type: "listItem", content: [p(t("un"))] }, { type: "listItem", content: [p(t("deux"))] }] },
          { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(t("trois"))] }] },
          { type: "blockquote", content: [p(t("Une citation"))] },
          { type: "encadre", attrs: { ton: "astuce" }, content: [p(t("Gagnez du temps"))] },
          { type: "encadre", attrs: { ton: "retenir" }, content: [p(t("L’essentiel"))] },
          { type: "imageLecon", attrs: { chemin: IMG, alt: "La fenêtre", legende: "Figure 1" } },
          {
            type: "table",
            content: [
              { type: "tableRow", content: [cell("tableHeader", "Mois"), cell("tableHeader", "Ventes")] },
              { type: "tableRow", content: [cell("tableCell", "Janvier"), cell("tableCell", "12")] },
            ],
          },
          { type: "horizontalRule" },
          { type: "videoLecon", attrs: { fournisseur: "youtube", id: "dQw4w9WgXcQ" } },
        )}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Importer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Depuis Excel" })).toBeInTheDocument();
    expect(screen.getByText("gras").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "le site" })).toHaveAttribute("rel", "noopener nofollow ugc");
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(document.querySelector("ul")?.children).toHaveLength(2);
    expect(document.querySelector("ol")).toHaveAttribute("start", "3");
    expect(screen.getByText("Une citation").closest("blockquote")).not.toBeNull();
    const astuce = screen.getByRole("note", { name: "Astuce" });
    expect(within(astuce).getByText("Gagnez du temps")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "À retenir" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "La fenêtre" })).toHaveAttribute("src", "https://stockage.exemple/signe.webp");
    expect(screen.getByText("Figure 1").tagName).toBe("FIGCAPTION");
    const tableau = screen.getByRole("table");
    expect(within(tableau).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Mois", "Ventes"]);
    expect(within(tableau).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Janvier", "12"]);
    expect(screen.getByRole("separator")).toBeInTheDocument();
    expect(screen.getByTitle(/Vidéo/)).toBeInTheDocument();
  });

  it("une cellule fusionnée garde sa fusion (relecture finale)", () => {
    render(
      <DocumentLecon
        images={{}}
        document={doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2, rowspan: 1, colwidth: null }, content: [p(t("Total"))] }] }] })}
      />,
    );
    expect(screen.getByRole("cell", { name: "Total" })).toHaveAttribute("colspan", "2");
  });

  it("un bloc inconnu ne rend rien, sans erreur", () => {
    const { container } = render(<DocumentLecon images={{}} document={doc({ type: "script", content: [t("alert(1)")] }, p(t("Suite")))} />);
    expect(container.textContent).toBe("Suite");
  });

  it("image sans lien signé : « Image indisponible »", () => {
    render(<DocumentLecon images={{}} document={doc({ type: "imageLecon", attrs: { chemin: IMG, alt: "", legende: "" } })} />);
    expect(screen.getByText("Image indisponible")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
