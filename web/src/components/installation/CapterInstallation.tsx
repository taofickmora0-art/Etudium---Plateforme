"use client";

import { useEffect } from "react";
import { capterInstallation, enregistrerServiceWorker } from "@/lib/pwa/installation";

/**
 * Dans l'en-tête de l'espace connecté (étudiant, formateur, back-office, leçon) : enregistre le service worker et garde
 * la demande d'installation de Chrome pour le menu du profil. L'en-tête s'affiche avant le compte : l'écoute commence
 * tôt, avant que Chrome n'envoie sa demande.
 */
export function CapterInstallation() {
  useEffect(() => {
    enregistrerServiceWorker();
    return capterInstallation();
  }, []);
  return null;
}
