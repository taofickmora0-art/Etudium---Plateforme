// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { choisirDansListe } from "../utilitaires/listes";

const SUJETS = [
  { value: "compte", label: "Mon compte" },
  { value: "paiement", label: "Paiement" },
  { value: "certificat", label: "Certificat" },
];

describe("Select, la liste déroulante d'Étudium", () => {
  it("le libellé du champ nomme la liste, et la liste ouverte a le dessin des menus", async () => {
    const user = userEvent.setup();
    render(
      <Field label="Sujet" htmlFor="sujet">
        <Select id="sujet" options={SUJETS} defaultValue="paiement" />
      </Field>,
    );
    const liste = screen.getByRole("combobox", { name: "Sujet" });
    expect(liste).toHaveTextContent("Paiement");
    expect(liste).toHaveAttribute("aria-expanded", "false");
    expect(liste).toHaveClass("h-12", "rounded-champ", "border-bordure-champ");

    await user.click(liste);
    const ouverte = screen.getByRole("listbox");
    expect(liste).toHaveAttribute("aria-expanded", "true");
    expect(ouverte).toHaveClass("rounded-menu", "shadow-menu", "bg-panneau");
    const options = within(ouverte).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Mon compte", "Paiement", "Certificat"]);
    // Lignes d'au moins 44 px, l'option choisie sur fond gris-bleu.
    for (const o of options) expect(o).toHaveClass("min-h-11", "focus-etudium");
    expect(within(ouverte).getByRole("option", { name: "Paiement" })).toHaveAttribute("data-state", "checked");
  });

  it("le choix appelle onValueChange, à la souris comme au clavier", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Controlee() {
      const [sujet, setSujet] = useState("compte");
      return (
        <Select
          aria-label="Sujet"
          options={SUJETS}
          value={sujet}
          onValueChange={(v) => {
            onValueChange(v);
            setSujet(v);
          }}
        />
      );
    }
    render(<Controlee />);
    await choisirDansListe("Sujet", "Certificat", { user });
    expect(onValueChange).toHaveBeenLastCalledWith("certificat");
    const liste = screen.getByRole("combobox", { name: "Sujet" });
    expect(liste).toHaveTextContent("Certificat");
    expect(liste).toHaveFocus();

    // Entrée ouvre, les flèches parcourent, Entrée choisit ; Échap referme sans rien changer.
    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowUp}{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith("paiement");
    await user.keyboard("{Enter}");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(liste).toHaveTextContent("Paiement");
  });

  it("le nom part avec le formulaire, une option vide comprise", async () => {
    const user = userEvent.setup();
    let envoi: FormData | undefined;
    render(
      <form
        aria-label="Réglages"
        onSubmit={(e) => {
          e.preventDefault();
          envoi = new FormData(e.currentTarget);
        }}
      >
        <Select
          aria-label="Badge"
          name="badge"
          options={[
            { value: "", label: "Aucun" },
            { value: "populaire", label: "Populaire" },
          ]}
          defaultValue=""
        />
        <button type="submit">Enregistrer</button>
      </form>,
    );
    expect(screen.getByRole("combobox", { name: "Badge" })).toHaveTextContent("Aucun");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(envoi?.get("badge")).toBe("");

    await choisirDansListe("Badge", "Populaire", { user });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(envoi?.getAll("badge")).toEqual(["populaire"]);

    // « Aucun » reste un vrai choix : on y revient.
    await choisirDansListe("Badge", "Aucun", { user });
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(envoi?.getAll("badge")).toEqual([""]);
  });

  it("l'indication s'affiche tant que rien n'est choisi, et le champ part vide", async () => {
    const user = userEvent.setup();
    const formulaire = render(
      <form aria-label="Profil">
        <Select aria-label="Pays" name="pays" placeholder="Choisir…" options={[{ value: "Bénin", label: "Bénin" }]} defaultValue="" />
      </form>,
    ).container.querySelector("form")!;
    const liste = screen.getByRole("combobox", { name: "Pays" });
    expect(liste).toHaveTextContent("Choisir…");
    expect(liste).toHaveAttribute("data-placeholder");
    expect(liste).toHaveClass("data-[placeholder]:text-indice");
    expect(new FormData(formulaire).get("pays")).toBe("");

    await choisirDansListe(liste, "Bénin", { user });
    expect(liste).toHaveTextContent("Bénin");
    expect(liste).not.toHaveAttribute("data-placeholder");
    expect(new FormData(formulaire).get("pays")).toBe("Bénin");
  });

  it("sans valeur ni indication, la première option est choisie, comme une liste du système", () => {
    render(<Select aria-label="Sujet" name="sujet" options={SUJETS} />);
    expect(screen.getByRole("combobox", { name: "Sujet" })).toHaveTextContent("Mon compte");
  });

  it("invalid et aria-invalid mettent la liste en erreur", () => {
    const { rerender } = render(<Select aria-label="Sujet" options={SUJETS} invalid />);
    const liste = screen.getByRole("combobox", { name: "Sujet" });
    expect(liste).toHaveAttribute("aria-invalid", "true");
    expect(liste).toHaveClass("aria-[invalid=true]:border-erreur-vif");
    rerender(<Select aria-label="Sujet" options={SUJETS} aria-invalid="true" />);
    expect(liste).toHaveAttribute("aria-invalid", "true");
    rerender(<Select aria-label="Sujet" options={SUJETS} />);
    expect(liste).not.toHaveAttribute("aria-invalid");
  });

  it("dans un champ en erreur, la liste est invalide et décrite par le message", () => {
    render(
      <Field label="Badge" htmlFor="badge" error="Badge inconnu.">
        <Select id="badge" options={SUJETS} />
      </Field>,
    );
    const liste = screen.getByRole("combobox", { name: "Badge" });
    expect(liste).toBeInvalid();
    expect(liste).toHaveAccessibleDescription("Badge inconnu.");
  });

  it("une liste désactivée ne s'ouvre pas et ne part pas avec le formulaire", async () => {
    const user = userEvent.setup();
    const formulaire = render(
      <form aria-label="Réglages">
        <Select aria-label="Sujet" name="sujet" options={SUJETS} disabled />
      </form>,
    ).container.querySelector("form")!;
    const liste = screen.getByRole("combobox", { name: "Sujet" });
    expect(liste).toBeDisabled();
    await user.click(liste);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(new FormData(formulaire).has("sujet")).toBe(false);
  });

  it("la frappe va à l'option qui commence par ces lettres (longue liste de pays)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const pays = ["Bénin", "Burkina Faso", "Cameroun", "Côte d’Ivoire", "Ghana", "Togo"].map((p) => ({ value: p, label: p }));
    render(<Select aria-label="Pays" options={pays} placeholder="Choisir…" onValueChange={onValueChange} />);
    const liste = screen.getByRole("combobox", { name: "Pays" });
    await user.click(liste);
    const ouverte = screen.getByRole("listbox");
    expect(ouverte).toHaveClass("max-h-[min(320px,var(--radix-select-content-available-height))]");
    await user.keyboard("To");
    expect(within(ouverte).getByRole("option", { name: "Togo" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("Togo");
  });

  it("une remise à zéro du formulaire ramène la dernière valeur de départ", async () => {
    const user = userEvent.setup();
    const options = [
      { value: "academique", label: "Académique" },
      { value: "digital", label: "Digital" },
      { value: "business", label: "Business" },
    ];
    const { rerender, container } = render(
      <form aria-label="Parcours">
        <Select aria-label="Couleur" name="couleur" options={options} defaultValue="academique" />
      </form>,
    );
    const formulaire = container.querySelector("form")!;
    await choisirDansListe("Couleur", "Digital", { user });
    // Après un enregistrement, la page rend la valeur enregistrée, puis React remet le formulaire à zéro.
    rerender(
      <form aria-label="Parcours">
        <Select aria-label="Couleur" name="couleur" options={options} defaultValue="digital" />
      </form>,
    );
    await choisirDansListe("Couleur", "Business", { user });
    formulaire.reset();
    expect(await screen.findByRole("combobox", { name: "Couleur" })).toHaveTextContent("Digital");
    expect(new FormData(formulaire).get("couleur")).toBe("digital");
  });
});
