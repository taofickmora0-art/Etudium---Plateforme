"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NotificationsPanel } from "@/components/ui/NotificationsPanel";
import { ProfileMenu } from "@/components/ui/ProfileMenu";
import type { ShellUser } from "@/lib/auth/current-user";
import { spaceOf } from "@/lib/auth/permissions";
import { LogoutDialog } from "./LogoutDialog";

/** Cloche et rond de profil de l'en-tête (NdNotificationsOuvertes, NdMesFormationsMenu). */
export function HeaderActions({ user }: { user: ShellUser }) {
  const [deconnexion, setDeconnexion] = useState(false);
  const profil = useRef<HTMLDivElement>(null);
  return (
    <>
      {/* Les notifications arrivent au lot 5 : le panneau dit « Vous êtes à jour ». */}
      <NotificationsPanel notifications={[]} onMarkAllRead={() => {}} />
      {/* Sous 1024 px, le profil passe par l'onglet « Profil » de la barre du bas. */}
      <div ref={profil} className="hidden lg:-mt-0.5 lg:-mb-px lg:-ml-0.5 lg:flex">
        <ProfileMenu
          user={{ initials: user.initials, name: `${user.prenom} ${user.nom}`, email: user.email, photoUrl: user.photoUrl }}
          roles={user.roles}
          currentSpace={spaceOf(usePathname())}
          onSignOut={() => setDeconnexion(true)}
        />
      </div>
      {/* Le menu a disparu quand la fenêtre se ferme : le focus revient au rond de profil. */}
      <LogoutDialog open={deconnexion} onOpenChange={setDeconnexion} returnFocus={() => profil.current?.querySelector("button")} />
    </>
  );
}
