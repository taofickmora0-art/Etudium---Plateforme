"use client";

import { useState } from "react";
import { useToastFacultatif } from "@/components/ui/Toast";
import { installer, useInstallation } from "@/lib/pwa/installation";

/**
 * « Installer l'application », pour les menus du profil (ordinateur et téléphone). Proposée quand Chrome a envoyé sa
 * demande (sa fenêtre d'installation s'ouvre) ou sur iPhone et iPad (la marche à suivre s'ouvre) ; jamais quand
 * l'appli est déjà installée, ni dans les autres navigateurs.
 */
export function useProposerInstallation() {
  const etat = useInstallation();
  const toast = useToastFacultatif();
  const [aideIos, setAideIos] = useState(false);
  const lancer = () => {
    if (etat === "ios") {
      setAideIos(true);
      return;
    }
    void installer().then((issue) => {
      if (issue === "acceptee") toast?.({ tone: "reussite", title: "Application installée." });
    });
  };
  return { proposee: etat === "installable" || etat === "ios", ios: etat === "ios", lancer, aideIos, setAideIos };
}
