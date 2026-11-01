// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CarteSession } from "@/components/sessions/CarteSession";
import { EspaceVerrouille } from "@/components/communaute/EspaceVerrouille";
import { etatAcces } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { REPLAYS, type Espace } from "@/lib/communaute/types";
import { etatFormation } from "@/lib/parcours/regles";
import type { SessionCarte } from "@/lib/sessions/types";
import type { CarteCatalogue } from "@/lib/catalogue/types";

// Ce que l'appli montre selon l'abonnement (lot 2, spec §5 et choix 1) : une formation payante ouverte par la base est
// « incluse » ; un live ou les replays d'un compte gratuit portent un cadenas et mènent aux abonnements.

const lecon = (id: string, champs: Record<string, unknown> = {}) => ({ id, titre: id, type: "lecon", apercu: false, accessible: false, ...champs });
const fiche = (lecons: ReturnType<typeof lecon>[], gratuite = false) =>
  ({ gratuite, modules: [{ id: "m", titre: "M", lecons }] }) as unknown as Pick<FicheFormation, "gratuite" | "modules">;

describe("Une formation payante", () => {
  it("ouverte par la base (abonnement) : incluse", () => {
    expect(etatAcces(fiche([lecon("a", { accessible: true }), lecon("b", { accessible: true })]), true)).toBe("incluse");
  });

  it("seulement son aperçu ouvert : aperçu ; rien d'ouvert : verrouillée", () => {
    expect(etatAcces(fiche([lecon("a", { apercu: true, accessible: true }), lecon("b")]), true)).toBe("apercu");
    expect(etatAcces(fiche([lecon("a"), lecon("b")]), true)).toBe("verrouillee");
  });

  it("gratuite : gratuite, comme avant", () => {
    expect(etatAcces(fiche([lecon("a", { accessible: true })], true), true)).toBe("gratuite");
  });

  it("dans un parcours : « Incluse » pour un abonné, verrouillée sinon", () => {
    const carte = { gratuite: false } as CarteCatalogue;
    expect(etatFormation(carte, undefined, true)).toEqual({ libelle: "Incluse", ton: "nouveau" });
    expect(etatFormation(carte)).toMatchObject({ libelle: "Verrouillée", verrou: true });
  });
});

const SESSION: SessionCarte = {
  id: "s1",
  titre: "Live Excel",
  description: "",
  debut: new Date(Date.now() + 86_400_000).toISOString(),
  dureeMinutes: 60,
  plateforme: "Google Meet",
  lien: null,
  parcours: null,
  animateur: "Équipe Étudium",
  inscriptions: 3,
  inscrit: false,
  statut: "programmee",
  reservee: true,
};

describe("Un live réservé aux abonnés", () => {
  it("un cadenas et « Voir les abonnements », sans inscription", () => {
    render(<CarteSession session={SESSION} maintenant={new Date()} onInscrire={vi.fn()} onDesinscrire={vi.fn()} />);
    expect(screen.getByText("Avec un abonnement")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
    expect(screen.queryByRole("button", { name: "Je m’inscris" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rejoindre" })).toBeNull();
  });

  it("un live passé : pas de replay pour un compte gratuit", () => {
    const passe = { ...SESSION, debut: new Date(Date.now() - 3 * 3_600_000).toISOString() };
    render(<CarteSession session={passe} maintenant={new Date()} onInscrire={vi.fn()} onDesinscrire={vi.fn()} />);
    expect(screen.queryByRole("link", { name: "Voir le replay" })).toBeNull();
    expect(screen.getByRole("link", { name: "Voir les abonnements" })).toBeInTheDocument();
  });

  it("un abonné garde « Je m’inscris »", () => {
    render(<CarteSession session={{ ...SESSION, reservee: false }} maintenant={new Date()} onInscrire={vi.fn()} onDesinscrire={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Je m’inscris" })).toBeInTheDocument();
    expect(screen.queryByText("Avec un abonnement")).toBeNull();
  });
});

describe("Les replays d'un compte gratuit", () => {
  it("l'espace fermé dit pourquoi et mène aux abonnements", () => {
    const replays: Espace = { id: REPLAYS, nom: "Replays de live", nomCourt: "Replays", couleur: null, slug: null, ouvert: false };
    render(<EspaceVerrouille espace={replays} />);
    expect(screen.getByText("Replays réservés aux abonnés")).toBeInTheDocument();
    expect(screen.getByText("Revoyez chaque live quand vous voulez avec un abonnement.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir les abonnements" })).toHaveAttribute("href", "/abonnement/souscrire");
  });
});
