import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Heading } from "@/components/ui/Text";
import { getShellUser } from "@/lib/auth/current-user";
import type { Role } from "@/lib/auth/permissions";
import { lireMesGroupes } from "@/lib/groupes/data";
import { MIGRATION_GROUPES } from "@/lib/groupes/regles";
import type { EspaceGroupes } from "@/lib/groupes/types";
import { ListeGroupes } from "./ListeGroupes";

/** L'équipe (modérateurs, admins, super admins) lit quelle migration appliquer ; les autres, le message neutre. */
export const estEquipe = (roles: Role[] | undefined) => (roles ?? []).some((r) => r === "moderateur" || r === "admin" || r === "super_admin");

/** Avant la 0075 : le bandeau de la migration pour l'équipe, un message neutre pour les autres. */
export function GroupesIndisponibles({ equipe }: { equipe: boolean }) {
  return equipe ? <Banner tone="attention" title={MIGRATION_GROUPES} /> : <BandeauIndisponible />;
}

/** La page « Groupes » d'un espace (spec des groupes, §2) : mes groupes, en direct. */
export async function PageGroupes({ espace }: { espace: EspaceGroupes }) {
  const [user, lu] = await Promise.all([getShellUser(), lireMesGroupes()]);
  return (
    <div className="flex max-w-[760px] min-w-0 flex-col gap-6 max-sm:gap-5">
      <div className="flex flex-col gap-1.5">
        <Heading level="page">Groupes</Heading>
        <p className="m-0 text-base leading-6 text-pretty text-discret max-sm:text-[15px] max-sm:leading-[22px]">
          {espace === "formateur"
            ? "Échangez en direct avec les étudiants de vos parcours et de vos formations."
            : "Échangez en direct avec les étudiants et les formateurs de vos parcours et de vos formations."}
        </p>
      </div>
      {lu.migrationAbsente ? <GroupesIndisponibles equipe={estEquipe(user?.roles)} /> : <ListeGroupes espace={espace} initiaux={lu.donnees} />}
    </div>
  );
}
