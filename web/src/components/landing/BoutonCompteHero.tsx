"use client";

import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { LienBlanc } from "@/components/catalogue/BlocsFiche";
import { Icon } from "@/components/ui/Icon";
import { useConnecte } from "@/components/site/useConnecte";

/** Le bouton principal du haut de la landing : l'inscription pour un visiteur, l'espace membre pour un compte connecté. */
export function BoutonCompteHero() {
  const connecte = useConnecte();
  return (
    <LienBlanc href={connecte ? "/accueil" : "/inscription"}>
      <span>{connecte ? "Accéder à l’espace membre" : "Créer mon compte gratuit"}</span>
      <Icon icon={ArrowRight02Icon} size={18} />
    </LienBlanc>
  );
}
