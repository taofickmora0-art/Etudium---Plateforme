import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";

// Pièces communes des pages « Mes formations » de l'espace formateur (spec de l'espace formateur, §3).

/** Début du fil d'Ariane de l'espace formateur (l'éditeur est celui du back-office, cadre compris). */
export const RACINE_FORMATEUR = { label: "Espace formateur", href: "/formateur" };
export const MES_FORMATIONS = { label: "Mes formations", href: "/formateur/formations" };

/**
 * Compte formateur sans fiche : il ne peut rien créer. Depuis la migration 0017, donner le rôle Formateur crée sa fiche ;
 * ce bandeau ne reste possible qu'avant elle, ou si une fiche a été supprimée.
 */
export function SansFiche() {
  return <Banner tone="attention" title="Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium." />;
}

/** La migration 0015 (suivi des étudiants, tableau de bord) n'est pas encore appliquée : un message neutre au formateur. */
export function MigrationSuiviAbsente() {
  return <BandeauIndisponible />;
}

/** La migration 0014 n'est pas encore appliquée : un message neutre au formateur, au lieu d'une erreur. */
export function MigrationFormateurAbsente() {
  return <BandeauIndisponible />;
}
