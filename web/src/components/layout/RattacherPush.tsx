"use client";

import { useEffect } from "react";
import { abonnementCourant, etatDuPush } from "@/lib/envois/abonnement-push";
import { enregistrerAppareil } from "@/lib/envois/actions";

const DEJA_FAIT = "etudium-push-rattache";

/**
 * Une fois par onglet et par compte, l'abonnement push de cet appareil est rattaché au compte connecté (point reporté
 * du lot 5) : un abonnement renouvelé par le navigateur (nouvelle adresse) reçoit de nouveau les notifications, sans
 * rallumer l'interrupteur. Rien sans autorisation ni abonnement : on ne demande jamais rien ici.
 */
export function RattacherPush({ compte }: { compte: string }) {
  useEffect(() => {
    if (etatDuPush() !== "possible" || Notification.permission !== "granted") return;
    // Un repère par compte : un autre compte connecté dans le même onglet (session fermée sans déconnexion) reprend
    // l'appareil pour lui.
    const repere = `${DEJA_FAIT}:${compte}`;
    try {
      if (window.sessionStorage.getItem(repere)) return;
      window.sessionStorage.setItem(repere, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on rattache quand même, au pire une fois par page.
    }
    void abonnementCourant().then((appareil) => {
      if (appareil) void enregistrerAppareil(appareil).catch(() => null);
    });
  }, [compte]);
  return null;
}
