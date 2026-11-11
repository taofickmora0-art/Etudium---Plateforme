"use client";

import { CreditCardIcon, Download01Icon, Home03Icon, Logout03Icon, Shield01Icon, TeachingIcon, UserIcon } from "@hugeicons/core-free-icons";
import { DropdownMenu } from "radix-ui";
import { canAccess, type Espace, type Role } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { Avatar } from "./Avatar";
import { MenuEntries, menuSeparatorClasses, menuSurfaceClasses, type MenuEntry } from "./Menu";
import { ProfileButton } from "./TopBarButtons";

export type { Role } from "@/lib/auth/permissions";

type ProfileMenuProps = {
  user: { initials: string; name: string; email: string; photoUrl?: string | null };
  /** Rôles de la personne connectée : décident des espaces proposés. L'accès réel est vérifié par le serveur. */
  roles: Role[];
  /** Espace où l'on se trouve (coché dans le menu). */
  currentSpace?: Espace;
  onSignOut: () => void;
  /** « Installer l'application » : seulement quand le navigateur le permet (Chrome, iPhone) et qu'elle ne l'est pas déjà. */
  onInstall?: () => void;
};

/** Menu du profil, ouvert depuis le rond de profil de la barre du haut (planche « Menus », « Menu du profil »). */
export function ProfileMenu({ user, roles, currentSpace = "etudiant", onSignOut, onInstall }: ProfileMenuProps) {
  // Un formateur sans « Étudiant » n'a pas l'espace étudiant (R1, 0079) : ni lui, ni l'abonnement ; son profil est dans
  // son espace. Plusieurs rôles : un espace par rôle.
  const apprenant = canAccess("etudiant", roles);
  const espaces: MenuEntry[] = apprenant ? [{ label: "Espace étudiant", icon: Home03Icon, href: "/accueil", current: currentSpace === "etudiant" }] : [];
  if (canAccess("formateur", roles)) espaces.push({ label: "Espace formateur", icon: TeachingIcon, href: "/formateur", current: currentSpace === "formateur" });
  if (canAccess("admin", roles))
    espaces.push({ label: "Back-office", icon: Shield01Icon, href: "/admin", current: currentSpace === "admin" });

  const items: MenuEntry[] = [
    { label: "Mon profil", icon: UserIcon, href: apprenant ? "/profil" : "/formateur/profil" },
    ...(apprenant ? [{ label: "Mon abonnement", icon: CreditCardIcon, href: "/abonnement" }] : []),
    // Un seul espace : inutile de proposer d'en changer.
    ...(espaces.length > 1 ? espaces : []),
    ...(onInstall ? [{ label: "Installer l’application", icon: Download01Icon, onSelect: onInstall }] : []),
    { separator: true },
    { label: "Se déconnecter", icon: Logout03Icon, danger: true, onSelect: onSignOut },
  ];

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <ProfileButton>{user.photoUrl ? <Avatar initials={user.initials} src={user.photoUrl} className="size-full" /> : undefined}</ProfileButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content aria-label="Menu du profil" align="end" sideOffset={8} className={cn(menuSurfaceClasses, "w-[280px]")}>
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <Avatar initials={user.initials} src={user.photoUrl} size={40} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[15px] leading-[22px] font-semibold text-encre">{user.name}</span>
              <span className="truncate text-[13px] leading-5 text-discret">{user.email}</span>
            </span>
          </div>
          <DropdownMenu.Separator className={menuSeparatorClasses} />
          <MenuEntries items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
