"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { jouerSonNotification, reglerSon, sonActif } from "@/lib/notifications/son";

/** « Son des notifications » (choix du 3 novembre 2026) : réglé pour cet appareil ; l'allumer fait entendre le son. */
export function InterrupteurSon() {
  const [actif, setActif] = useState(() => (typeof window === "undefined" ? true : sonActif()));
  return (
    <Switch
      label="Son des notifications"
      description="Deux notes quand une notification arrive, site ouvert, sur cet appareil"
      checked={actif}
      onCheckedChange={(valeur) => {
        setActif(valeur);
        reglerSon(valeur);
        if (valeur) jouerSonNotification({ forcer: true });
      }}
      className="min-h-11 py-2.5"
    />
  );
}
