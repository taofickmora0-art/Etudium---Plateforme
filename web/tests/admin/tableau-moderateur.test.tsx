// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableauModerateur } from "@/components/admin/TableauModerateur";

// La vue d'ensemble d'un modérateur (lot 6 A, spec §1.2) : ce qu'il a à traiter, sans chiffres de la plateforme.

describe("La vue d'ensemble du modérateur", () => {
  it("contenus à examiner, messages non lus, prochaines sessions, chacun vers sa page", () => {
    render(<TableauModerateur aExaminer={3} messagesNonLus={1} sessionsAVenir={2} />);
    expect(screen.getByRole("heading", { name: "À traiter" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Contenus à examiner\s*3/ })).toHaveAttribute("href", "/admin/moderation");
    expect(screen.getByRole("link", { name: /Messages non lus\s*1/ })).toHaveAttribute("href", "/admin/messages");
    expect(screen.getByRole("link", { name: /Sessions live à venir\s*2/ })).toHaveAttribute("href", "/admin/sessions");
  });

  it("une lecture impossible : « — »", () => {
    render(<TableauModerateur aExaminer={null} messagesNonLus={null} sessionsAVenir={null} />);
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
});
