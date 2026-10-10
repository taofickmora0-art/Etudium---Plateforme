// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CourseIcon, Home03Icon } from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vitest";
import { Accordion } from "@/components/ui/Accordion";
import { BottomBar } from "@/components/ui/BottomBar";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { Stepper } from "@/components/ui/Stepper";

describe("Navigation", () => {
  it("l'entrée active est annoncée", () => {
    render(
      <nav>
        <SidebarItem href="/" icon={Home03Icon} label="Accueil" />
        <SidebarItem href="/formations" icon={CourseIcon} label="Mes formations" active />
      </nav>,
    );
    expect(screen.getByRole("link", { name: "Mes formations" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Accueil" })).not.toHaveAttribute("aria-current");
  });

  it("le fil d'Ariane marque la page courante", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Mes formations", href: "/formations" },
          { label: "Maîtriser Microsoft Excel", href: "/formations/excel" },
          { label: "Module 3" },
        ]}
      />,
    );
    expect(screen.getByRole("navigation", { name: "Fil d’Ariane" })).toBeInTheDocument();
    expect(screen.getByText("Module 3")).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("l'accordéon déplie une question", async () => {
    const user = userEvent.setup();
    render(
      <Accordion
        items={[
          { question: "Puis-je changer de formule en cours de mois ?", answer: "Oui, au prorata." },
          { question: "Mes certificats restent-ils valables ?", answer: "Oui, avec leur QR Code." },
        ]}
      />,
    );
    const question = screen.getByRole("button", { name: "Mes certificats restent-ils valables ?" });
    expect(question).toHaveAttribute("aria-expanded", "false");
    await user.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Oui, avec leur QR Code.")).toBeVisible();
  });

  it("le stepper annonce l'étape courante", () => {
    render(<Stepper steps={["Formule", "Parcours", "Paiement", "Confirmation"]} current={2} />);
    const items = screen.getAllByRole("listitem");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveTextContent(/terminée/);
  });

  it("la barre du bas marque l'onglet actif", () => {
    render(
      <BottomBar
        items={[
          { href: "/", icon: Home03Icon, label: "Accueil", active: true },
          { href: "/formations", icon: CourseIcon, label: "Formations" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
  });
});
