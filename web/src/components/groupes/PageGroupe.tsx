import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";
import { getShellUser } from "@/lib/auth/current-user";
import { lireGroupe } from "@/lib/groupes/data";
import { CHEMINS_GROUPES } from "@/lib/groupes/regles";
import type { EspaceGroupes, GroupeFerme as Ferme } from "@/lib/groupes/types";
import { DiscussionGroupe } from "./DiscussionGroupe";
import { estEquipe, GroupesIndisponibles } from "./PageGroupes";

const LIEN = "focus-etudium flex items-center gap-1.5 self-start rounded-champ text-sm leading-[22px] font-medium text-texte no-underline hover:text-bleu md:hidden";

/** Pourquoi le groupe est fermé, et où aller : les abonnements, les parcours, la formation. */
function GroupeFerme({ groupe: g, espace }: { groupe: Ferme; espace: EspaceGroupes }) {
  const parcours = g.parcours?.nom ?? g.nom;
  const titre = g.formation?.titre ?? g.nom;
  const description = {
    abonnement: `Ce groupe est réservé aux abonnés et aux étudiants inscrits à une formation du parcours ${parcours}. Un abonnement ouvre tous les groupes des parcours.`,
    formateur: `Ce groupe est réservé aux formateurs des formations du parcours ${parcours}, à ses abonnés et à ses inscrits.`,
    inscription: `Ce groupe est réservé aux étudiants inscrits à la formation « ${titre} ». Inscrivez-vous pour le rejoindre.`,
    desactive: `Le groupe de discussion de la formation « ${titre} » n’est pas ouvert pour le moment.`,
  }[g.raison];
  const action =
    espace === "formateur" ? null : g.raison === "abonnement" ? (
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/abonnement/souscrire">Voir les abonnements</Link>
        </Button>
        <Button asChild variant="contour">
          <Link href="/parcours">Voir les parcours</Link>
        </Button>
      </div>
    ) : g.raison === "inscription" && g.formation ? (
      <Button asChild className="mt-3">
        <Link href={`/formations/${g.formation.slug}`}>Voir la formation</Link>
      </Button>
    ) : null;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto bg-page p-6 max-sm:p-4">
      <Link href={CHEMINS_GROUPES[espace].liste} className={LIEN}>
        <Icon icon={ArrowLeft01Icon} size={18} />
        <span>Tous les groupes</span>
      </Link>
      <Heading level="page">{g.nom}</Heading>
      <EmptyState icon={SquareLock02Icon} title="Ce groupe ne vous est pas ouvert" description={description} action={action} />
    </div>
  );
}

/**
 * La page d'un groupe (spec des groupes, §2) : sa discussion en direct, ou pourquoi il est fermé au compte. `message` :
 * le message d'une notification, où la page se place. Avant la 0075 : le bandeau de la migration pour l'équipe, un
 * message neutre pour les autres.
 */
export async function PageGroupe({ espace, slug, message }: { espace: EspaceGroupes; slug: string; message: string | null }) {
  const [user, lu] = await Promise.all([getShellUser(), lireGroupe(slug, message)]);
  if (lu.migrationAbsente) {
    return (
      <div className="flex min-w-0 flex-col gap-6 p-6 max-sm:p-4">
        <Heading level="page">Groupes</Heading>
        <GroupesIndisponibles equipe={estEquipe(user?.roles)} />
      </div>
    );
  }
  if (!lu.donnees) notFound();
  const { groupe, fil } = lu.donnees;
  if (!groupe.ouvert) return <GroupeFerme groupe={groupe} espace={espace} />;
  if (!fil) notFound();
  return <DiscussionGroupe key={groupe.id} espace={espace} groupeInitial={groupe} filInitial={fil} cible={message} />;
}
