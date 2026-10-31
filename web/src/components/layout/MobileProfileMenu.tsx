import { Home03Icon, Shield01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { List, ListRow } from "@/components/ui/ListRow";
import type { ShellUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/auth/permissions";
import { NAV_MENU_FORMATEUR, NAV_MENU_TELEPHONE } from "@/lib/navigation";
import { MenuLogout } from "./MenuLogout";

/**
 * Page « Profil » du téléphone (NdMobMenu, simplifiée le 31 octobre 2026) : le compte seulement, comme le menu du rond
 * de profil sur ordinateur. Son profil, son abonnement, le changement d'espace s'il en a plusieurs (l'équipe : Espace
 * étudiant et Back-office), la déconnexion. Le reste (parcours, exercices, certificats…) est dans le menu ≡. Côté
 * formateur (restructuration R1) : son profil, sans abonnement ni changement d'espace (il n'a que le sien).
 */
export function MobileProfileMenu({ user, espace = "etudiant" }: { user: ShellUser; espace?: "etudiant" | "formateur" }) {
  const formateur = espace === "formateur";
  const equipe = !formateur && canAccess("admin", user.roles);
  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Profil</h1>
      <div className="flex items-center gap-3.5">
        <Avatar initials={user.initials} src={user.photoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-lg leading-[26px] font-semibold text-encre">
            {user.prenom} {user.nom}
          </h2>
          <p className="m-0 truncate text-sm leading-[22px] text-discret">{formateur ? "Formateur·rice" : `${user.statut} · ${user.formule}`}</p>
        </div>
      </div>
      <List label="Mon compte" className="mt-1">
        {(formateur ? NAV_MENU_FORMATEUR : NAV_MENU_TELEPHONE).map((e) => (
          <ListRow key={e.href} href={e.href} leading={<Icon icon={e.icon} size={22} />} title={e.label} />
        ))}
        {/* Deux espaces : l'équipe passe de l'un à l'autre (comme dans le menu du profil sur ordinateur). */}
        {equipe && <ListRow href="/accueil" leading={<Icon icon={Home03Icon} size={22} />} title="Espace étudiant" />}
        {equipe && <ListRow href="/admin" leading={<Icon icon={Shield01Icon} size={22} />} title="Back-office" />}
        <MenuLogout />
      </List>
    </div>
  );
}
