import type { ReactNode } from "react";
import { Shield01Icon, TeachingIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { List, ListRow } from "@/components/ui/ListRow";
import { PointsIcon, StreakIcon } from "@/components/ui/TopBarIcons";
import type { ShellUser } from "@/lib/demo-user";
import { NAV_MENU_TELEPHONE } from "@/lib/navigation";
import { MenuLogout } from "./MenuLogout";

function Tuile({ glyph, valeur, legende }: { glyph: ReactNode; valeur: string; legende: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-bouton bg-coque px-3.5 py-2.5">
      <span className="flex items-center gap-2 text-base leading-6 font-medium text-texte">
        {glyph}
        <span className="truncate">{valeur}</span>
      </span>
      <span className="text-xs leading-[18px] text-ardoise">{legende}</span>
    </div>
  );
}

/** Page « Profil » du téléphone (NdMobMenu) : identité, série et points, raccourcis, déconnexion. */
export function MobileProfileMenu({ user }: { user: ShellUser }) {
  return (
    <div className="flex flex-col">
      <h1 className="sr-only">Profil</h1>
      <div className="flex items-center gap-3.5">
        <Avatar initials={user.initials} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-lg leading-[26px] font-semibold text-encre">
            {user.prenom} {user.nom}
          </h2>
          <p className="m-0 truncate text-sm leading-[22px] text-discret">
            {user.statut} · {user.formule}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tuile glyph={<StreakIcon />} valeur={`${user.serie} jours`} legende="Série d’apprentissage" />
        <Tuile glyph={<PointsIcon />} valeur={`${user.points} points`} legende="Gagnés cette semaine" />
      </div>
      <List label="Raccourcis" className="mt-1">
        {NAV_MENU_TELEPHONE.map((e) => (
          <ListRow key={e.href} href={e.href} leading={<Icon icon={e.icon} size={22} />} title={e.label} />
        ))}
        {/* Espaces selon les rôles, comme dans le menu du profil sur ordinateur. L'accès réel est vérifié par le serveur. */}
        {user.roles.includes("formateur") && (
          <ListRow href="/formateur" leading={<Icon icon={TeachingIcon} size={22} />} title="Espace formateur" />
        )}
        {user.roles.some((r) => r === "admin" || r === "super_admin" || r === "moderateur") && (
          <ListRow href="/admin" leading={<Icon icon={Shield01Icon} size={22} />} title="Back-office" />
        )}
        <MenuLogout />
      </List>
    </div>
  );
}
