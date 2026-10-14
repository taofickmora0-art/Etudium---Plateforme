"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { versPanneau } from "@/components/notifications/affichage";
import { NotificationsPanel } from "@/components/ui/NotificationsPanel";
import { ProfileMenu } from "@/components/ui/ProfileMenu";
import type { ShellUser } from "@/lib/auth/current-user";
import { spaceOf } from "@/lib/auth/permissions";
import { chargerCloche, marquerLues } from "@/lib/notifications/actions";
import { EVENEMENT_NOTIFICATIONS } from "@/lib/notifications/regles";
import type { LotNotifications } from "@/lib/notifications/types";
import { LogoutDialog } from "./LogoutDialog";

const VIDE: LotNotifications = { lignes: [], suite: false, nonLues: 0 };

/**
 * Les 8 dernières notifications et le nombre de non lues (spec des notifications, §3). L'en-tête reste en place d'une
 * page à l'autre : la cloche se recharge à chaque changement de page, et quand la page Notifications en marque lues.
 */
function useCloche() {
  const chemin = usePathname();
  const [cloche, setCloche] = useState<LotNotifications>(VIDE);
  // Seule la dernière lecture compte : une réponse plus ancienne arrivée après elle est ignorée.
  const demande = useRef(0);

  const charger = useCallback(async () => {
    const numero = ++demande.current;
    const lu = await chargerCloche();
    if (numero === demande.current) setCloche(lu ?? VIDE);
  }, []);

  useEffect(() => {
    void charger();
  }, [chemin, charger]);

  useEffect(() => {
    const recharger = () => void charger();
    window.addEventListener(EVENEMENT_NOTIFICATIONS, recharger);
    return () => window.removeEventListener(EVENEMENT_NOTIFICATIONS, recharger);
  }, [charger]);

  const toutLire = () => {
    setCloche((c) => ({ ...c, nonLues: 0, lignes: c.lignes.map((n) => ({ ...n, lue: true })) }));
    void marquerLues(null);
  };
  const lire = (id: string) => {
    setCloche((c) => {
      const cible = c.lignes.find((n) => n.id === id);
      if (!cible || cible.lue) return c;
      return { ...c, nonLues: Math.max(0, c.nonLues - 1), lignes: c.lignes.map((n) => (n.id === id ? { ...n, lue: true } : n)) };
    });
    void marquerLues([id]);
  };
  return { cloche, toutLire, lire };
}

/** Cloche et rond de profil de l'en-tête (NdNotificationsOuvertes, NdMesFormationsMenu). */
export function HeaderActions({ user }: { user: ShellUser }) {
  const [deconnexion, setDeconnexion] = useState(false);
  const profil = useRef<HTMLDivElement>(null);
  const { cloche, toutLire, lire } = useCloche();
  const maintenant = new Date();
  return (
    <>
      <NotificationsPanel
        notifications={cloche.lignes.map((n) => versPanneau(n, maintenant))}
        unreadCount={cloche.nonLues}
        onMarkAllRead={toutLire}
        onSelect={lire}
      />
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
