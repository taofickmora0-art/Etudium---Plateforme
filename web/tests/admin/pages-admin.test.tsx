// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const compterContenus = vi.fn();
vi.mock("@/lib/admin/data", async () => {
  const vrai = await vi.importActual<typeof import("@/lib/admin/data")>("@/lib/admin/data");
  return { ...vrai, compterContenus: () => compterContenus() };
});
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: vi.fn() }));

const { ResumeBackOffice } = await import("@/components/admin/ResumeBackOffice");
const { TablesAbsentesError } = await import("@/lib/admin/data");

describe("Accueil du back-office", () => {
  beforeEach(() => {
    compterContenus.mockReset();
  });

  it("l'accueil du back-office résume les contenus", async () => {
    compterContenus.mockResolvedValue({ parcours: 3, formateurs: 1, publiees: 10, brouillons: 0, archivees: 0 });
    render(await ResumeBackOffice());
    expect(screen.getByRole("link", { name: /Parcours/ })).toHaveAttribute("href", "/admin/parcours");
    expect(screen.getByText("3 parcours")).toBeInTheDocument();
    expect(screen.getByText("1 fiche")).toBeInTheDocument();
    expect(screen.getByText("10 publiées · 0 brouillon · 0 archivée")).toBeInTheDocument();
  });

  it("les pluriels suivent les nombres", async () => {
    compterContenus.mockResolvedValue({ parcours: 1, formateurs: 2, publiees: 1, brouillons: 2, archivees: 3 });
    render(await ResumeBackOffice());
    expect(screen.getByText("1 parcours")).toBeInTheDocument();
    expect(screen.getByText("2 fiches")).toBeInTheDocument();
    expect(screen.getByText("1 publiée · 2 brouillons · 3 archivées")).toBeInTheDocument();
  });

  it("les tables absentes sont annoncées", async () => {
    compterContenus.mockRejectedValue(new TablesAbsentesError());
    render(await ResumeBackOffice());
    expect(screen.getByText("Les tables du lot 1 ne sont pas encore dans la base.")).toBeInTheDocument();
  });
});
