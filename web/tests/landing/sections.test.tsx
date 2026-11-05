// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroLanding } from "@/components/landing/HeroLanding";
import { SectionCommunaute } from "@/components/landing/SectionCommunaute";
import { SectionFaq } from "@/components/landing/SectionFaq";
import { SectionFormules } from "@/components/landing/SectionFormules";
import { SectionAccompagnement, SectionEtapes, SectionProblemes, SectionSolution } from "@/components/landing/SectionsPresentation";

function toutesLesSections() {
  return render(
    <>
      <HeroLanding />
      <SectionProblemes />
      <SectionSolution />
      <SectionEtapes />
      <SectionFormules formules={[]} />
      <SectionAccompagnement />
      <SectionCommunaute />
      <SectionFaq />
    </>,
  );
}

const masque = (texte: string) => screen.getByText(texte).closest('[aria-hidden="true"]');

describe("Sections à texte fixe de la landing (NdLanding)", () => {
  it("un seul titre de niveau 1 : la phrase du hero", () => {
    toutesLesSections();
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("Les compétences qui comptent, pendant vos études et après.");
  });

  it("chaque section est reliée à son titre", () => {
    const { container } = toutesLesSections();
    const sections = [...container.querySelectorAll("section")];
    expect(sections).toHaveLength(8);
    for (const section of sections) {
      const id = section.getAttribute("aria-labelledby");
      expect(id, section.outerHTML.slice(0, 80)).toBeTruthy();
      expect(["H1", "H2"]).toContain(document.getElementById(id ?? "")?.tagName);
    }
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Le diplôme ne suffit plus. Les outils et les compétences font la différence.",
      "Un seul endroit pour apprendre, pratiquer et être accompagné",
      "Quatre étapes, de l’inscription au certificat",
      "Un abonnement de 3 mois à 1 an, sans prélèvement automatique",
      "Vous n’apprenez jamais seul",
      "Une communauté par parcours",
      "Tout ce qu’il faut savoir avant de commencer",
    ]);
  });

  it("les ancres de l'en-tête et du pied de page existent", () => {
    const { container } = toutesLesSections();
    for (const id of ["formules", "communaute", "faq"]) expect(container.querySelector(`#${id}`), id).not.toBeNull();
  });

  it("formules sans prix (Q10) : « Prix annoncés au lancement » dans chaque carte, pas de « Voir le détail »", () => {
    toutesLesSections();
    expect(screen.getAllByText("Prix annoncés au lancement")).toHaveLength(3);
    expect(screen.getByText("Recommandée")).toBeInTheDocument();
    expect(screen.queryByText("Voir le détail")).toBeNull();
    expect(screen.queryByText(/\[PRIX\]|FCFA/)).toBeNull();
  });

  it("ni témoignages ni chiffres inventés (Q11)", () => {
    toutesLesSections();
    expect(screen.queryByText("Ils ont suivi Étudium")).toBeNull();
    expect(screen.queryByText(/\[NOMBRE\]|\[Prénom N\.\]/)).toBeNull();
  });

  it("les 7 questions fréquentes, la première dépliée", () => {
    toutesLesSections();
    const faq = document.getElementById("faq") as HTMLElement;
    const boutons = within(faq).getAllByRole("button");
    expect(boutons).toHaveLength(7);
    expect(boutons.map((b) => b.getAttribute("aria-expanded"))).toEqual(["true", "false", "false", "false", "false", "false", "false"]);
    expect(within(faq).getByText(/Il donne accès aux formations gratuites/)).toBeInTheDocument();
  });

  it("les illustrations inventées ne sont pas lues et ne contiennent ni lien ni bouton", () => {
    toutesLesSections();
    for (const texte of ["68 % terminé", "Koffi D.", "Dr Mireille Adjovi", "ET-2026-EXC-4821", "Certificat obtenu"]) {
      const illustration = masque(texte);
      expect(illustration, texte).not.toBeNull();
      expect(illustration?.querySelector("a, button, [tabindex]"), texte).toBeNull();
    }
  });

  it("les boutons et les puces du hero", () => {
    render(<HeroLanding />);
    expect(screen.getByRole("link", { name: "Créer mon compte gratuit" })).toHaveAttribute("href", "/inscription");
    expect(screen.getByRole("link", { name: "Découvrir les formations" })).toHaveAttribute("href", "/formations");
    for (const nom of ["Réussite académique", "Compétences digitales", "Entrepreneuriat"]) {
      expect(screen.getByRole("link", { name: nom })).toHaveAttribute("href", "#parcours");
    }
  });

  it("« Voir la communauté » mène à l'Accueil, qui est la communauté", () => {
    render(<SectionCommunaute />);
    expect(screen.getByRole("link", { name: "Voir la communauté" })).toHaveAttribute("href", "/accueil");
  });

  it("problèmes et étapes en listes numérotées, numéros non lus", () => {
    render(
      <>
        <SectionProblemes />
        <SectionEtapes />
      </>,
    );
    const listes = screen.getAllByRole("list");
    expect(listes.map((l) => l.tagName)).toEqual(["OL", "OL"]);
    expect(within(listes[0]).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByText("01")[0]).toHaveAttribute("aria-hidden", "true");
  });
});
