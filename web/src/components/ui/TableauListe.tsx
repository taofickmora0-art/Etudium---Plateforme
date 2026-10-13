import type { ReactNode } from "react";

/** Une cellule du tableau du design : 56 px de haut, filet en haut. */
export const CELLULE_TABLEAU = "h-14 border-t border-bordure-carte px-4 py-2 text-left align-middle";

type TableauListeProps = {
  /** Nom du tableau pour les lecteurs d'écran (« Comptes »). */
  nom: string;
  /** Nom du cadre qui défile (« Tableau des comptes »). */
  nomCadre: string;
  colonnes: string[];
  /** Une dernière colonne d'actions (menu ⋮), titrée pour les lecteurs d'écran seulement. */
  actions?: boolean;
  /** Largeur sous laquelle le tableau défile dans son cadre (900 px par défaut). */
  largeurMin?: number;
  /** Chargement en cours (aria-busy). */
  occupe?: boolean;
  /** Les lignes (`<tr>` de cellules `CELLULE_TABLEAU`). */
  children: ReactNode;
};

/**
 * Le tableau du design (NdAdminUtilisateurs) : en-tête sur fond bleu pâle, lignes de 56 px séparées d'un filet, cadre
 * arrondi. Sur un petit écran, le tableau défile dans son cadre (atteignable au clavier) ; la page ne s'élargit jamais.
 * Le cadre est positionné : le texte réservé aux lecteurs d'écran (absolu) ne s'en échappe pas.
 */
export function TableauListe({ nom, nomCadre, colonnes, actions = false, largeurMin = 900, occupe, children }: TableauListeProps) {
  return (
    <div role="region" aria-label={nomCadre} tabIndex={0} className="focus-etudium relative overflow-x-auto rounded-2xl border border-bordure-carte">
      <table aria-label={nom} aria-busy={occupe} style={{ minWidth: largeurMin }} className="w-full border-collapse text-sm leading-5 text-texte">
        <thead>
          <tr>
            {colonnes.map((titre) => (
              <th key={titre} scope="col" className="bg-page px-4 py-3.5 text-left text-[13px] font-medium whitespace-nowrap text-ardoise">
                {titre}
              </th>
            ))}
            {actions && (
              <th scope="col" className="w-[50px] bg-page px-4 py-3.5">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
