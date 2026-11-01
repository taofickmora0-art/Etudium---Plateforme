import { notFound } from "next/navigation";
import { SectionAbonnement } from "@/components/admin/abonnements/SectionAbonnement";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Avatar } from "@/components/ui/Avatar";
import { getAuthUser } from "@/lib/auth/current-user";
import { lireFormules } from "@/lib/abonnement/data";
import { lireAbonnementsCompte } from "@/lib/admin/paiements/data";
import type { Role } from "@/lib/auth/permissions";
import { lireCompte, lireRemarquesFormateurs } from "@/lib/utilisateurs/data";
import { dateCourte, droitsSurCompte, initialesCompte, nomAffiche } from "@/lib/utilisateurs/regles";
import { ActiviteCompte } from "./ActiviteCompte";
import { EtiquettesRoles } from "./EtiquettesRoles";
import { MigrationAbsente } from "./MigrationAbsente";
import { RemarquesFormateurs } from "./RemarquesFormateurs";
import { RoleCompte } from "./RoleCompte";
import { Section } from "./Section";
import { SuspensionCompte } from "./SuspensionCompte";

const FIL_LISTE = { label: "Utilisateurs", href: "/admin/utilisateurs" };

/**
 * Fiche d'un compte (spec des utilisateurs, §3) : identité, rôle, activité, suspension. La page vérifie l'équipe avant
 * (requireSpace) et passe les rôles de la personne connectée ; un identifiant inconnu donne la page introuvable.
 */
export async function FicheUtilisateur({ params, roles }: { params: Promise<{ id: string }>; roles: Role[] }) {
  const { id } = await params;
  const lecture = await lireCompte(id);
  if (lecture.migrationAbsente) {
    return (
      <PageAdmin titre="Utilisateur" fil={[FIL_LISTE, { label: "Utilisateur" }]}>
        <MigrationAbsente />
      </PageAdmin>
    );
  }
  const compte = lecture.donnees;
  if (!compte) notFound();

  const connecte = await getAuthUser();
  const droits = droitsSurCompte({ id: connecte?.id ?? "", roles }, { id: compte.id, roles: compte.roles, suspendu: compte.suspension !== null });
  const formateur = compte.roles.includes("formateur");
  // L'abonnement (0054) : pas pour un formateur, qui n'a pas d'espace étudiant ; rien sans la migration.
  const [remarques, abonnements, formules] = await Promise.all([
    lireRemarquesFormateurs(compte.id),
    formateur ? Promise.resolve(null) : lireAbonnementsCompte(compte.id),
    formateur ? Promise.resolve([]) : lireFormules(),
  ]);
  const nom = nomAffiche(compte.prenom, compte.nom);
  // L'argent (attribuer, résilier) : administrateurs seulement ; la base le revérifie.
  const ecritureAbonnement = roles.includes("admin") || roles.includes("super_admin");

  return (
    <PageAdmin titre={nom} fil={[FIL_LISTE, { label: nom }]}>
      <div className="flex max-w-[680px] min-w-0 flex-col gap-5">
        <Section titre="Identité">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar initials={initialesCompte(compte.prenom, compte.nom, compte.email)} size={56} />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] leading-[22px] font-medium break-all text-encre">{compte.email}</span>
              <span className="text-[13px] leading-5 text-discret">
                {`Inscrit le ${dateCourte(compte.inscritLe)} · Dernière connexion : ${compte.derniereConnexion ? dateCourte(compte.derniereConnexion) : "Jamais"}`}
              </span>
              <EtiquettesRoles roles={compte.roles} suspendu={compte.suspension !== null} />
            </div>
          </div>
        </Section>
        <RoleCompte compte={compte} modifiable={droits.changerRole} />
        {abonnements && <SectionAbonnement compte={{ id: compte.id, nom }} donnees={abonnements} formules={formules} ecriture={ecritureAbonnement} maintenant={new Date().toISOString()} />}
        <ActiviteCompte compte={compte} />
        <RemarquesFormateurs remarques={remarques.migrationAbsente ? null : remarques.donnees} />
        <SuspensionCompte compte={compte} droits={{ suspendre: droits.suspendre, reactiver: droits.reactiver }} />
      </div>
    </PageAdmin>
  );
}
