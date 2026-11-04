import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Skeleton } from "@/components/ui/Skeleton";
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

/** Le volet de gauche pendant la lecture des groupes. */
export function ListeEnAttente() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-7 w-32 rounded-puce" />
      <Skeleton className="h-12 rounded-champ" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 rounded-carte" />
      ))}
    </div>
  );
}

/**
 * Le volet de gauche des « Groupes » d'un espace (spec des groupes, §2 ; deux volets, 4 novembre 2026) : le titre, la
 * recherche et mes groupes, en direct. Avant la 0075 : le titre et le bandeau.
 */
export async function PageGroupes({ espace }: { espace: EspaceGroupes }) {
  const [user, lu] = await Promise.all([getShellUser(), lireMesGroupes()]);
  if (lu.migrationAbsente) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <h1 className="m-0 text-xl leading-7 font-semibold text-encre">Groupes</h1>
        <GroupesIndisponibles equipe={estEquipe(user?.roles)} />
      </div>
    );
  }
  return <ListeGroupes espace={espace} initiaux={lu.donnees} />;
}
