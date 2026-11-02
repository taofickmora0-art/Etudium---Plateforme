"use client";

import { useEffect } from "react";
import { abonnementCourant, etatDuPush } from "@/lib/envois/abonnement-push";
import { enregistrerAppareil } from "@/lib/envois/actions";

const DEJA_FAIT = "etudium-push-rattache";

/**
 * Une fois par session du navigateur, l'abonnement push de cet appareil est rattaché au compte connecté (point reporté
 * du lot 5) : un abonnement renouvelé par le navigateur (nouvelle adresse) reçoit de nouveau les notifications, sans
 * rallumer l'interrupteur. Rien sans autorisation ni abonnement : on ne demande jamais rien ici.
 */
export function RattacherPush() {
  useEffect(() => {
    if (etatDuPush() !== "possible" || Notification.permission !== "granted") return;
    try {
      if (window.sessionStorage.getItem(DEJA_FAIT)) return;
      window.sessionStorage.setItem(DEJA_FAIT, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on rattache quand même, au pire une fois par page.
    }
    void abonnementCourant().then((appareil) => {
      if (appareil) void enregistrerAppareil(appareil).catch(() => null);
    });
  }, []);
  return null;
}
