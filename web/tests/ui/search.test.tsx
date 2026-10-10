// @vitest-environment jsdom
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SearchSuggestions } from "@/components/ui/SearchSuggestions";

// Le routeur de Next n'existe pas hors de l'application : on observe seulement la page demandée.
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function Recherche() {
  const [query, setQuery] = useState("");
  return (
    <SearchSuggestions
      query={query}
      onQueryChange={setQuery}
      resultsHref={(q) => `/recherche?q=${encodeURIComponent(q)}`}
      groups={[{ title: "Formations", items: [{ label: "Maîtriser Microsoft Excel", href: "/formations/excel" }] }]}
    />
  );
}

describe("Recherche", () => {
  it("Entrée ouvre la page de tous les résultats", async () => {
    const user = userEvent.setup();
    render(<Recherche />);
    await user.type(screen.getByLabelText("Rechercher"), "excel{Enter}");
    expect(push).toHaveBeenCalledWith("/recherche?q=excel");
  });
});
