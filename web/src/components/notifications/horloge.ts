"use client";

import { useSyncExternalStore } from "react";

// L'heure des notifications (« Il y a 4 min »). Le premier affichage du navigateur reprend l'heure du serveur, sinon
// une minute qui bascule entre les deux ferait différer le texte (écart à l'hydratation) ; ensuite, l'heure de
// l'appareil, rafraîchie toutes les 30 secondes.

let horloge = 0;

function abonner(signaler: () => void) {
  horloge = Date.now();
  const minuterie = setInterval(() => {
    horloge = Date.now();
    signaler();
  }, 30_000);
  return () => clearInterval(minuterie);
}

// Une valeur stable d'un appel à l'autre : elle ne change qu'à l'abonnement et à chaque tic.
const lire = () => horloge || (horloge = Date.now());

/** L'heure à afficher ; `heureServeur` (ISO) : celle du rendu serveur, pour le premier affichage. */
export function useMaintenant(heureServeur?: string): Date {
  const instant = useSyncExternalStore(abonner, lire, () => (heureServeur ? Date.parse(heureServeur) : lire()));
  return new Date(instant);
}
