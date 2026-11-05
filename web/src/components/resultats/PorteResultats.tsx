import type { ReactNode } from "react";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { lireEtatResultats } from "@/lib/resultats/data";
import type { EtatResultats } from "@/lib/resultats/types";
import { ApresOubli } from "./ApresOubli";
import { DeverrouillageResultats } from "./DeverrouillageResultats";
import { PropositionPin } from "./PropositionPin";
import { ZoneProtegee } from "./ZoneProtegee";

type PorteResultatsProps = {
  /** Le contenu de l'espace, ou une fonction qui le construit d'après l'état (le bouton « Sécurité » en a besoin). */
  children: ReactNode | ((etat: EtatResultats) => ReactNode);
  /** Le retour d'un « Code oublié ? » (?oubli=1) : l'écran du nouveau code. */
  oubli?: boolean;
};

/**
 * La porte de « Mes résultats » (spec du 5 novembre 2026, §4). Avec un code et sans ouverture, le clavier seul : la base
 * ne rend de toute façon rien sans le jeton. Sans code, la proposition (une fois). Ouvert avec un code, la minuterie.
 */
export async function PorteResultats({ children, oubli = false }: PorteResultatsProps) {
  const etat = await lireEtatResultats();
  if (!etat) return <BandeauIndisponible />;
  if (oubli) return <ApresOubli pin={etat.pin} />;
  if (etat.pin && !etat.ouvert) return <DeverrouillageResultats bloqueJusqua={etat.bloqueJusqua} />;
  if (!etat.pin && !etat.propose) return <PropositionPin />;
  const contenu = typeof children === "function" ? children(etat) : children;
  return etat.pin ? <ZoneProtegee>{contenu}</ZoneProtegee> : contenu;
}
