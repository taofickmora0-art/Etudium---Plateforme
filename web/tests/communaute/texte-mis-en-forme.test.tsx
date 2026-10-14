// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TexteMisEnForme } from "@/components/communaute/TexteMisEnForme";

// L'affichage du texte mis en forme (spec mise en forme et vidéo, §2) : chaque élément est construit, jamais du HTML.

describe("Le texte mis en forme", () => {
  it("titres (niveaux 4 à 6 sous le titre de la carte), gras, italique, souligné, barré, listes, citation", () => {
    const { container } = render(
      <TexteMisEnForme texte={"# Un\n## Deux\n### Trois\n\nDu **gras**, de l’_italique_, du ++souligné++, du ~~barré~~.\nÀ la ligne.\n\n- a\n- b\n\n3. c\n\n> cité"} />,
    );
    expect(screen.getByRole("heading", { level: 4, name: "Un" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 5, name: "Deux" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 6, name: "Trois" })).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("gras");
    expect(container.querySelector("em")).toHaveTextContent("italique");
    expect(container.querySelector("u")).toHaveTextContent("souligné");
    expect(container.querySelector("s")).toHaveTextContent("barré");
    expect(container.querySelector("br")).not.toBeNull();
    expect([...container.querySelectorAll("ul > li")].map((li) => li.textContent)).toEqual(["a", "b"]);
    expect(container.querySelector("ol")).toHaveAttribute("start", "3");
    expect(container.querySelector("blockquote")).toHaveTextContent("cité");
  });

  it("un lien, même en gras, reste un lien ; un texte forgé reste du texte ; une ancienne publication s'affiche comme avant", () => {
    const { container, unmount } = render(<TexteMisEnForme texte={"Rejoignez **https://meet.google.com/abc-defg-hij** <script>alert(1)</script>"} />);
    expect(screen.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" }).closest("strong")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container).toHaveTextContent("<script>alert(1)</script>");
    unmount();
    render(<TexteMisEnForme texte={"Bonjour à tous\nqui a le plan ?\n\nMerci 5 * 3"} />);
    expect(screen.getByText(/Bonjour à tous/)).toBeInTheDocument();
    expect(screen.getByText("Merci 5 * 3")).toBeInTheDocument();
  });

  it("un texte rendu cliquable : un lien vers son adresse, dans un nouvel onglet, même en gras", () => {
    const { container } = render(<TexteMisEnForme texte={"Voir [le programme](https://etudium.bj/programme) et **[gras](https://a.com)**"} />);
    const programme = screen.getByRole("link", { name: "le programme" });
    expect(programme).toHaveAttribute("href", "https://etudium.bj/programme");
    expect(programme).toHaveAttribute("target", "_blank");
    expect(programme).toHaveAttribute("rel", "noopener nofollow ugc");
    expect(screen.getByRole("link", { name: "gras" }).closest("strong")).not.toBeNull();
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });
});
