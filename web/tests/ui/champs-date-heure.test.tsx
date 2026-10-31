// @vitest-environment jsdom
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChampDate } from "@/components/ui/ChampDate";
import { ChampHeure } from "@/components/ui/ChampHeure";
import { Field } from "@/components/ui/Field";

// La date et l'heure au style d'Étudium (demande du 31 octobre 2026), à la place des sélecteurs du navigateur : un champ
// texte comme dans le design (« 24/10/2026 », « 15:00 »), où l'on tape, et une icône qui ouvre le calendrier ou les heures.

function AvecDate({ initiale = "", min, onChange = () => {} }: { initiale?: string; min?: string; onChange?: (v: string) => void }) {
  const [valeur, setValeur] = useState(initiale);
  return (
    <Field label="Date" htmlFor="d">
      <ChampDate
        id="d"
        value={valeur}
        min={min}
        onChange={(v) => {
          setValeur(v);
          onChange(v);
        }}
      />
    </Field>
  );
}

function AvecHeure({ initiale = "", onChange = () => {} }: { initiale?: string; onChange?: (v: string) => void }) {
  const [valeur, setValeur] = useState(initiale);
  return (
    <Field label="Heure" htmlFor="h">
      <ChampHeure
        id="h"
        value={valeur}
        onChange={(v) => {
          setValeur(v);
          onChange(v);
        }}
      />
    </Field>
  );
}

describe("La date", () => {
  it("le champ affiche jj/mm/aaaa ; taper une date la donne au format ISO (aussi collée en ISO)", async () => {
    const onChange = vi.fn();
    render(<AvecDate initiale="2026-10-24" onChange={onChange} />);
    const champ = screen.getByRole("textbox", { name: "Date" });
    expect(champ).toHaveValue("24/10/2026");
    expect(champ).toHaveAttribute("placeholder", "jj/mm/aaaa");
    fireEvent.change(champ, { target: { value: "05/11/2026" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-11-05");
    fireEvent.change(champ, { target: { value: "2026-12-01" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-12-01");
    fireEvent.change(champ, { target: { value: "31/02/2026" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("le calendrier : le mois de la date, les jours de la semaine, choisir un jour ferme et remplit le champ", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AvecDate initiale="2026-10-24" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Choisir une date" }));
    const calendrier = screen.getByRole("dialog", { name: "Choisir une date" });
    expect(within(calendrier).getByText("Octobre 2026")).toBeInTheDocument();
    expect(within(calendrier).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["lu", "ma", "me", "je", "ve", "sa", "di"]);
    expect(within(calendrier).getByRole("button", { name: "samedi 24 octobre 2026" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(calendrier).getByRole("button", { name: "Mois suivant" }));
    expect(within(calendrier).getByText("Novembre 2026")).toBeInTheDocument();
    await user.click(within(calendrier).getByRole("button", { name: "jeudi 5 novembre 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-05");
    expect(screen.queryByRole("dialog", { name: "Choisir une date" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Date" })).toHaveValue("05/11/2026");
  });

  it("avant la date minimale : jours désactivés", async () => {
    const user = userEvent.setup();
    render(<AvecDate initiale="2026-10-24" min="2026-10-20" />);
    await user.click(screen.getByRole("button", { name: "Choisir une date" }));
    const calendrier = screen.getByRole("dialog", { name: "Choisir une date" });
    expect(within(calendrier).getByRole("button", { name: "lundi 19 octobre 2026" })).toBeDisabled();
    expect(within(calendrier).getByRole("button", { name: "mardi 20 octobre 2026" })).toBeEnabled();
  });

  it("au clavier : les flèches changent de jour, Entrée choisit", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AvecDate initiale="2026-10-24" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Choisir une date" }));
    expect(screen.getByRole("button", { name: "samedi 24 octobre 2026" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "dimanche 25 octobre 2026" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "dimanche 1 novembre 2026" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith("2026-11-01");
  });
});

describe("L'heure", () => {
  it("le champ affiche hh:mm ; taper une heure la donne ; une heure impossible est vide", () => {
    const onChange = vi.fn();
    render(<AvecHeure initiale="15:00" onChange={onChange} />);
    const champ = screen.getByRole("textbox", { name: "Heure" });
    expect(champ).toHaveValue("15:00");
    fireEvent.change(champ, { target: { value: "9:30" } });
    expect(onChange).toHaveBeenLastCalledWith("09:30");
    fireEvent.change(champ, { target: { value: "25:00" } });
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("la liste : les heures puis les minutes de 5 en 5 ; choisir les deux remplit le champ et ferme", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AvecHeure initiale="15:00" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Choisir une heure" }));
    const fenetre = screen.getByRole("dialog", { name: "Choisir une heure" });
    const heures = within(fenetre).getByRole("group", { name: "Heures" });
    const minutes = within(fenetre).getByRole("group", { name: "Minutes" });
    expect(within(heures).getAllByRole("button")).toHaveLength(24);
    expect(within(minutes).getAllByRole("button").map((b) => b.textContent)).toEqual(["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]);
    expect(within(heures).getByRole("button", { name: "15 h" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(heures).getByRole("button", { name: "18 h" }));
    expect(onChange).toHaveBeenLastCalledWith("18:00");
    await user.click(within(minutes).getByRole("button", { name: "30 min" }));
    expect(onChange).toHaveBeenLastCalledWith("18:30");
    expect(screen.queryByRole("dialog", { name: "Choisir une heure" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Heure" })).toHaveValue("18:30");
  });
});
