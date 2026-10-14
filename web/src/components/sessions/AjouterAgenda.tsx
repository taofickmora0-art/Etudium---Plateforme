"use client";

import { useSyncExternalStore } from "react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { fichierIcs, lienGoogleAgenda } from "@/lib/sessions/agenda";
import type { SessionCarte } from "@/lib/sessions/types";

const rien = () => () => {};

/**
 * L'adresse de la page Événements, pour l'agenda (le lien du live n'est pas encore connu à l'inscription). Le serveur ne
 * connaît pas l'adresse du site : « /evenements » au rendu serveur et à l'hydratation, l'adresse complète ensuite.
 */
function useAdresseEvenements() {
  const origine = useSyncExternalStore(rien, () => window.location.origin, () => null);
  return origine ? `${origine}/evenements` : "/evenements";
}

/** « Ajouter à mon agenda » : ouvre Google Agenda dans un nouvel onglet, sur l'événement pré-rempli. */
export function AjouterAgenda({ session, variante = "contour" }: { session: SessionCarte; variante?: "contour" | "discret" }) {
  const adresse = useAdresseEvenements();
  return (
    <Button variant={variante} asChild>
      <a href={lienGoogleAgenda(session, adresse)} target="_blank" rel="noopener noreferrer">
        {variante === "discret" && <Icon icon={Calendar03Icon} size={18} />}
        Ajouter à mon agenda
      </a>
    </Button>
  );
}

/** « Autre agenda (.ics) » : le fichier pour Apple Calendar et Outlook, avec une alerte 10 min avant. */
export function FichierAgenda({ session }: { session: SessionCarte }) {
  const ics = fichierIcs(session, useAdresseEvenements(), new Date());
  return (
    <a
      href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
      download="etudium-session.ics"
      className="focus-etudium rounded-puce text-[13px] leading-5 font-medium text-bleu underline-offset-2 hover:underline"
    >
      Autre agenda (.ics)
    </a>
  );
}
