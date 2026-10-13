// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogCard } from "@/components/ui/CatalogCard";
import { Couverture } from "@/components/ui/Couverture";

const URL_COUVERTURE = "https://projet.supabase.co/storage/v1/object/public/couvertures/f1/a.jpg";
const EXCEL = {
  href: "/formations/excel",
  title: "Maîtriser Microsoft Excel",
  description: "Formules, tableaux croisés dynamiques et graphiques.",
  parcours: "academique" as const,
  tag: { tone: "populaire" as const, label: "Populaire" },
  level: "Intermédiaire",
};

describe("Couverture d'une formation", () => {
  it("avec une image : une img décorative, cadrée en 16:9 sans déformation (object-cover)", () => {
    const { container } = render(<Couverture src={URL_COUVERTURE} parcours="academique" sizes="320px" />);
    const img = container.querySelector("img")!;
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveClass("object-cover");
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain(URL_COUVERTURE);
    expect(container.firstElementChild).toHaveClass("aspect-video");
  });

  it("sans image : la couverture par défaut, aux couleurs du parcours, avec son illustration", () => {
    const { container } = render(<Couverture src={null} parcours="digital" sizes="320px" />);
    expect(container.querySelector("img")).toBeNull();
    const cadre = container.firstElementChild!;
    expect(cadre).toHaveAttribute("data-parcours", "digital");
    expect(cadre).toHaveClass("aspect-video", "bg-premium-fond");
    expect(cadre.querySelector("svg")).not.toBeNull();
  });
});

describe("Cartes avec couverture", () => {
  it("l'image en haut, le badge posé dessus ; le titre reste le nom du lien", () => {
    const { container } = render(<CatalogCard {...EXCEL} couverture={URL_COUVERTURE} />);
    const cadre = container.querySelector("[data-couverture]")!;
    expect(cadre.querySelector("img")).not.toBeNull();
    expect(cadre).toContainElement(screen.getByText("Populaire"));
    expect(screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).toHaveAttribute("href", "/formations/excel");
  });

  it("sur la couverture, un badge garde son contour (anneau blanc), même sur un fond de sa couleur", () => {
    render(<CatalogCard {...EXCEL} parcoursTag={{ tone: "academique", label: "Académique" }} />);
    for (const libelle of ["Académique", "Populaire"]) expect(screen.getByText(libelle)).toHaveClass("ring-2", "ring-white");
  });

  it("sans image : la couverture par défaut du parcours", () => {
    const { container } = render(<CatalogCard {...EXCEL} />);
    const cadre = container.querySelector("[data-couverture]")!;
    expect(cadre.querySelector("img")).toBeNull();
    expect(cadre.querySelector("[data-parcours='academique']")).not.toBeNull();
  });
});
