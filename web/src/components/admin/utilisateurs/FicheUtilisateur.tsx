import { notFound } from "next/navigation";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { Avatar } from "@/components/ui/Avatar";
import { getAuthUser } from "@/lib/auth/current-user";
import type { Role } from "@/lib/auth/permissions";
import { lireCompte, lireFichesLibres } from "@/lib/utilisateurs/data";
import { dateCourte, droitsSurCompte, initialesCompte, nomAffiche } from "@/lib/utilisateurs/regles";
import { ActiviteCompte } from "./ActiviteCompte";
import { EtiquettesRoles } from "./EtiquettesRoles";
import { MigrationAbsente } from "./MigrationAbsente";
import { RolesCompte } from "./RolesCompte";
import { Section } from "./Section";
import { SuspensionCompte } from "./SuspensionCompte";

const FIL_LISTE = { label: "Utilisateurs", href: "/admin/utilisateurs" };

/**
 * Fiche d'un compte (spec des utilisateurs, §3) : identité, rôles, activité, suspension. La page vérifie l'équipe avant
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
  const fichesLibres = droits.changerRoles ? await lireFichesLibres() : [];
  const nom = nomAffiche(compte.prenom, compte.nom);

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
        <RolesCompte compte={compte} fichesLibres={fichesLibres} modifiable={droits.changerRoles} />
        <ActiviteCompte compte={compte} />
        <SuspensionCompte compte={compte} droits={{ suspendre: droits.suspendre, reactiver: droits.reactiver }} />
      </div>
    </PageAdmin>
  );
}
