import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type Utilisateur = ReturnType<typeof userEvent.setup>;

/**
 * Choisit une option dans une liste déroulante d'Étudium (`Select`, dessinée avec Radix) comme le ferait quelqu'un :
 * clic sur la liste, puis clic sur l'option dans la liste ouverte. Remplace `userEvent.selectOptions`, qui ne sert
 * qu'aux listes du système.
 *
 * @param liste le nom accessible de la liste (son libellé), ou la liste elle-même
 * @param option le libellé de l'option, tel qu'il s'affiche
 * @param reglages `dans` : où chercher la liste (une fenêtre, une carte) ; `user` : l'utilisateur du test, s'il en a un
 */
export async function choisirDansListe(
  liste: string | RegExp | HTMLElement,
  option: string | RegExp,
  { dans, user = userEvent.setup() }: { dans?: HTMLElement; user?: Utilisateur } = {},
) {
  const declencheur = liste instanceof HTMLElement ? liste : (dans ? within(dans) : screen).getByRole("combobox", { name: liste });
  await user.click(declencheur);
  // La liste ouverte est dans un portail, au bout du document.
  const ouverte = screen.getByRole("listbox");
  await user.click(within(ouverte).getByRole("option", { name: option }));
}

/** Ouvre la liste, lit le libellé de ses options dans l'ordre, puis la referme (Échap). */
export async function optionsDeLaListe(liste: HTMLElement, { user = userEvent.setup() }: { user?: Utilisateur } = {}) {
  await user.click(liste);
  const libelles = within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((o) => o.textContent ?? "");
  await user.keyboard("{Escape}");
  return libelles;
}
