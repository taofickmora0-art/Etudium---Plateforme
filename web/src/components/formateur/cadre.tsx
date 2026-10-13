import { Banner } from "@/components/ui/Banner";

// Pièces communes des pages « Mes formations » de l'espace formateur (spec de l'espace formateur, §3).

/** Début du fil d'Ariane de l'espace formateur (l'éditeur est celui du back-office, cadre compris). */
export const RACINE_FORMATEUR = { label: "Espace formateur", href: "/formateur" };
export const MES_FORMATIONS = { label: "Mes formations", href: "/formateur/formations" };

/** Compte formateur sans fiche reliée par le super admin (page Utilisateurs) : il ne peut rien créer. */
export function SansFiche() {
  return <Banner tone="attention" title="Votre compte n’est pas encore relié à une fiche formateur. Contactez l’équipe Étudium." />;
}

/** La migration 0015 (suivi des étudiants, tableau de bord) n'est pas encore appliquée. */
export function MigrationSuiviAbsente() {
  return (
    <Banner tone="attention" title="Le suivi des étudiants n’est pas encore dans la base.">
      Appliquez la migration 0015 (guide « Ce qui te revient », section 20).
    </Banner>
  );
}

/** La migration 0014 n'est pas encore appliquée : on le dit au lieu d'afficher une erreur. */
export function MigrationFormateurAbsente() {
  return (
    <Banner tone="attention" title="La création de formations par les formateurs n’est pas encore dans la base.">
      Appliquez la migration 0014 (guide « Ce qui te revient », section 19).
    </Banner>
  );
}
