// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { LeconAdmin } from "@/lib/admin/types";

vi.mock("@/lib/admin/actions", () => ({ saveLecon: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { LeconForm } = await import("@/components/admin/LeconForm");

const LECON: LeconAdmin = {
  id: "l1",
  moduleId: "m1",
  formationId: "f1",
  formationTitre: "Maîtriser Microsoft Excel",
  titre: "Les tableaux croisés dynamiques",
  titreCourt: "Tableaux croisés dynamiques",
  dureeSecondes: 760,
  apercu: false,
  resume: "",
  pointsCles: ["Créer un tableau croisé dynamique", "Modifier la structure du tableau"],
  video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" },
  texte: "",
  ressources: [],
};

const afficher = (lecon: LeconAdmin) =>
  render(
    <ToastProvider>
      <LeconForm lecon={lecon} />
    </ToastProvider>,
  );

describe("Formulaire d'une leçon", () => {
  it("la leçon enregistrée réaffiche son lien, sa durée et ses points clés", () => {
    afficher(LECON);
    expect(screen.getByLabelText("Lien de la vidéo")).toHaveValue("https://youtu.be/dQw4w9WgXcQ");
    expect(screen.getByText("Reconnu : YouTube · dQw4w9WgXcQ")).toBeInTheDocument();
    expect(screen.getByLabelText("Durée")).toHaveValue("12:40");
    expect(screen.getByLabelText("Points clés")).toHaveValue("Créer un tableau croisé dynamique\nModifier la structure du tableau");
  });

  it("le lien collé est reconnu pendant la frappe", async () => {
    afficher({ ...LECON, video: null });
    const champ = screen.getByLabelText("Lien de la vidéo");
    expect(champ).toHaveValue("");
    await userEvent.type(champ, "https://vimeo.com/76979871");
    expect(screen.getByText("Reconnu : Vimeo · 76979871")).toBeInTheDocument();
    await userEvent.clear(champ);
    await userEvent.type(champ, "https://exemple.com/x.mp4");
    expect(screen.getByText("Lien non reconnu : collez un lien YouTube ou Vimeo.")).toBeInTheDocument();
  });
});
