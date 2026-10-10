import { redirect } from "next/navigation";
import { demoModeActive } from "@/lib/auth/current-user";

// Une page qui ne fait que rediriger n'a rien à afficher instantanément : pas de validation « instant ».
export const instant = false;

/**
 * La racine oriente : le proxy envoie déjà vers l'accueil ou la connexion selon la session (le site public arrive au lot 1).
 * Ce repli ne sert qu'en mode démonstration, où le proxy laisse passer : on montre alors l'état de la base.
 */
export default function Racine() {
  redirect(demoModeActive() ? "/etat" : "/connexion");
}
