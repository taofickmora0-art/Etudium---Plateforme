// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";

// Le tableau du design (NdAdminUtilisateurs), partagé par la page Utilisateurs, la page Étudiants et le tableau de bord
// du formateur : en-tête bleu pâle, lignes de 56 px, cadre qui défile sur un petit écran.

describe("Tableau du design", () => {
  it("le cadre et le tableau sont nommés ; l'en-tête liste les colonnes ; la colonne Actions est pour les lecteurs d'écran", () => {
    render(
      <TableauListe nom="Comptes" nomCadre="Tableau des comptes" colonnes={["Utilisateur", "E-mail"]} actions>
        <tr>
          <td className={CELLULE_TABLEAU}>Aïcha</td>
          <td className={CELLULE_TABLEAU}>a@exemple.com</td>
          <td className={CELLULE_TABLEAU} />
        </tr>
      </TableauListe>,
    );
    const cadre = screen.getByRole("region", { name: "Tableau des comptes" });
    const tableau = within(cadre).getByRole("table", { name: "Comptes" });
    expect(within(tableau).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Utilisateur", "E-mail", "Actions"]);
    expect(within(tableau).getAllByRole("columnheader")[2].querySelector(".sr-only")).not.toBeNull();
    expect(within(tableau).getAllByRole("row")).toHaveLength(2);
  });

  it("le cadre est positionné et défile : le texte caché ne s'en échappe pas ; largeur minimale réglable", () => {
    render(
      <TableauListe nom="Étudiants" nomCadre="Tableau des étudiants" colonnes={["Étudiant"]} largeurMin={760}>
        <tr>
          <td className={CELLULE_TABLEAU}>Fifamè</td>
        </tr>
      </TableauListe>,
    );
    const cadre = screen.getByRole("region", { name: "Tableau des étudiants" });
    expect(cadre.className).toMatch(/\brelative\b/);
    expect(cadre.className).toMatch(/overflow-x-auto/);
    expect(cadre).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table").style.minWidth).toBe("760px");
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });
});
