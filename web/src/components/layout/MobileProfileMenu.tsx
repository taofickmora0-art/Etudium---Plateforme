import type { ReactNode } from "react";
import Link from "next/link";
import { Home03Icon, Shield01Icon, TeachingIcon } from "@hugeicons/core-free-icons";
import { LigneInstallation } from "@/components/installation/LigneInstallation";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { List, ListRow } from "@/components/ui/ListRow";
import { PointsIcon, StreakIcon } from "@/components/ui/TopBarIcons";
import type { ShellUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/auth/permissions";
import { jours, points } from "@/lib/engagement/regles";
import { NAV_MENU_FORMATEUR, NAV_MENU_TELEPHONE } from "@/lib/navigation";
import { MenuLogout } from "./MenuLogout";

/** Une tuile de NdMobMenu : la série ou les points de la semaine, vers le tableau de bord (lot 6 B). */
function Tuile({ glyph, valeur, legende, nom }: { glyph: ReactNode; valeur: string; legende: string; nom: string }) {
  return (
    <Link href="/tableau-de-bord" aria-label={nom} className="focus-etudium flex min-w-0 flex-col gap-0.5 rounded-bouton bg-coque px-3.5 py-2.5 no-underline transition-colors hover:bg-coque-survol">
      <span className="flex items-center gap-2 text-base leading-6 font-medium text-texte">
        {glyph}
        <span className="truncate">{valeur}</span>
      </span>
      <span className="text-xs leading-[18px] text-ardoise">{legende}</span>
    </Link>
  );
}

/**
 * Page « Profil » du téléphone (NdMobMenu, simplifiée le 31 octobre 2026) : le compte seulement, comme le menu du rond
 * de profil sur ordinateur. Son profil, son abonnement, le changement d'espace s'il en a plusieurs (l'équipe : Espace
 * étudiant et Back-office), la déconnexion. Le reste (parcours, exercices, certificats…) est dans le menu ≡. La série
 * et les points de la semaine reviennent en tuiles (lot 6 B), maintenant qu'ils sont réels. Côté formateur
 * (restructuration R1) : son profil, sans abonnement ni changement d'espace (il n'a que le sien), ni série ni points.
 * Pour tous, « Installer l'application » quand le navigateur le permet (demande du 3 novembre 2026).
 */
export function MobileProfileMenu({ user, espace = "etudiant" }: { user: ShellUser; espace?: "etudiant" | "formateur" }) {
  const formateur = espace === "formateur";
  // Plusieurs espaces (l'équipe, ou plusieurs rôles depuis la 0079) : on passe de l'un à l'autre, comme dans le menu du
  // profil sur ordinateur.
  const espaces = [
    canAccess("etudiant", user.roles) && { href: "/accueil", icon: Home03Icon, titre: "Espace étudiant" },
    canAccess("formateur", user.roles) && { href: "/formateur", icon: TeachingIcon, titre: "Espace formateur" },
    canAccess("admin", user.roles) && { href: "/admin", icon: Shield01Icon, titre: "Back-office" },
  ].filter((e) => e !== false);
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
      {!formateur && canAccess("etudiant", user.roles) && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Tuile glyph={<StreakIcon />} valeur={jours(user.serie)} legende="Série d’apprentissage" nom={`Série d’apprentissage : ${jours(user.serie)}`} />
          <Tuile glyph={<PointsIcon />} valeur={points(user.points)} legende="Gagnés cette semaine" nom={`Points gagnés cette semaine : ${points(user.points)}`} />
        </div>
      )}
      <List label="Mon compte" className="mt-1">
        {(formateur ? NAV_MENU_FORMATEUR : NAV_MENU_TELEPHONE).map((e) => (
          <ListRow key={e.href} href={e.href} leading={<Icon icon={e.icon} size={22} />} title={e.label} />
        ))}
        {espaces.length > 1 && espaces.map((e) => <ListRow key={e.href} href={e.href} leading={<Icon icon={e.icon} size={22} />} title={e.titre} />)}
        <LigneInstallation />
        <MenuLogout />
      </List>
    </div>
  );
}
