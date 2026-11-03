"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AideInstallationIos } from "@/components/installation/AideInstallationIos";
import { useProposerInstallation } from "@/components/installation/useProposerInstallation";
import { versPanneau } from "@/components/notifications/affichage";
import { TempsReel } from "@/components/temps-reel/TempsReel";
import { useTempsReel } from "@/components/temps-reel/evenements";
import { jouerSonNotification } from "@/lib/notifications/son";
import { NotificationsPanel } from "@/components/ui/NotificationsPanel";
import { ProfileMenu } from "@/components/ui/ProfileMenu";
import { useToastFacultatif } from "@/components/ui/Toast";
import type { ShellUser } from "@/lib/auth/current-user";
import { canAccess, spaceOf } from "@/lib/auth/permissions";
import { chargerCloche, marquerLues } from "@/lib/notifications/actions";
import { EVENEMENT_NOTIFICATIONS } from "@/lib/notifications/regles";
import type { LotNotifications, NotificationLue } from "@/lib/notifications/types";
import { LogoutDialog } from "./LogoutDialog";

const VIDE: LotNotifications = { lignes: [], suite: false, nonLues: 0 };

/** La cloche se recharge seule toutes les minutes, tant que l'onglet est visible (spec Formations et Événements, §3.2). */
export const INTERVALLE_CLOCHE_MS = 60_000;

const plusGrand = (lignes: NotificationLue[]) => lignes.reduce((max, n) => Math.max(max, Number(n.id) || 0), 0);

/**
 * Les 8 dernières notifications et le nombre de non lues (spec des notifications, §3). L'en-tête reste en place d'une
 * page à l'autre : la cloche se recharge aussitôt qu'une notification arrive ou qu'il en lit ailleurs (temps réel, 0044),
 * à chaque changement de page, quand la page Notifications en marque lues, et, en secours, toutes les minutes tant que
 * l'onglet est visible et au retour sur l'onglet. Une notification de session live arrivée depuis
 * (« C’est l’heure du live », rappel 10 min avant) s'annonce aussi en bas de l'écran.
 */
function useCloche() {
  const chemin = usePathname();
  const router = useRouter();
  const toast = useToastFacultatif();
  const [cloche, setCloche] = useState<LotNotifications>(VIDE);
  // Seule la dernière lecture compte : une réponse plus ancienne arrivée après elle est ignorée.
  const demande = useRef(0);
  // La plus récente déjà vue ; null avant le premier chargement (rien n'est annoncé au premier).
  const vue = useRef<number | null>(null);
  // Le routeur et le toast par référence : `charger` reste stable (sinon chaque rendu relancerait la lecture).
  const outils = useRef({ router, toast });
  useEffect(() => {
    outils.current = { router, toast };
  });

  const charger = useCallback(async () => {
    const numero = ++demande.current;
    let lu: LotNotifications | null;
    try {
      lu = await chargerCloche();
    } catch {
      // Base ou réseau injoignable : la cloche garde ce qu'elle avait, le prochain passage réessaiera.
      return;
    }
    if (numero !== demande.current) return;
    setCloche(lu ?? VIDE);
    if (!lu) return;
    const avant = vue.current;
    vue.current = Math.max(avant ?? 0, plusGrand(lu.lignes));
    const { router: routeur, toast: annoncer } = outils.current;
    // Une notification arrivée depuis la dernière lecture : le son « Deux notes » (pas au premier chargement, ni quand
    // une notification passe à « lue »).
    if (avant !== null && lu.lignes.some((n) => !n.lue && Number(n.id) > avant)) jouerSonNotification();
    if (avant === null || !annoncer) return;
    const nouvelle = lu.lignes.find((n) => !n.lue && n.categorie === "sessions_live" && Number(n.id) > avant);
    if (nouvelle) {
      annoncer({
        tone: "information",
        title: nouvelle.titre,
        description: nouvelle.texte || undefined,
        action: { label: "Voir", onClick: () => routeur.push(nouvelle.lien ?? "/evenements") },
      });
    }
  }, []);

  useEffect(() => {
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") void charger();
    }, INTERVALLE_CLOCHE_MS);
    const retour = () => {
      if (document.visibilityState === "visible") void charger();
    };
    document.addEventListener("visibilitychange", retour);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", retour);
    };
  }, [charger]);

  useEffect(() => {
    void charger();
  }, [chemin, charger]);

  useTempsReel("notification", () => void charger());

  useEffect(() => {
    const recharger = () => void charger();
    window.addEventListener(EVENEMENT_NOTIFICATIONS, recharger);
    return () => window.removeEventListener(EVENEMENT_NOTIFICATIONS, recharger);
  }, [charger]);

  // Marquer lu écarte la lecture en cours, partie avant (sinon elle réafficherait les non lues).
  const toutLire = () => {
    demande.current++;
    setCloche((c) => ({ ...c, nonLues: 0, lignes: c.lignes.map((n) => ({ ...n, lue: true })) }));
    void marquerLues(null);
  };
  const lire = (id: string) => {
    demande.current++;
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
  const installation = useProposerInstallation();
  const maintenant = new Date();
  return (
    <>
      {/* Le temps réel (0044) : une seule connexion par page, ici, là où est la cloche. */}
      <TempsReel />
      <NotificationsPanel
        notifications={cloche.lignes.map((n) => versPanneau(n, maintenant))}
        unreadCount={cloche.nonLues}
        onMarkAllRead={toutLire}
        onSelect={lire}
        // Un formateur a ses notifications dans son espace (restructuration R1).
        allHref={canAccess("etudiant", user.roles) ? "/notifications" : "/formateur/notifications"}
      />
      {/* Sous 1024 px, le profil passe par l'onglet « Profil » de la barre du bas. */}
      <div ref={profil} className="hidden lg:-mt-0.5 lg:-mb-px lg:-ml-0.5 lg:flex">
        <ProfileMenu
          user={{ initials: user.initials, name: `${user.prenom} ${user.nom}`, email: user.email, photoUrl: user.photoUrl }}
          roles={user.roles}
          currentSpace={spaceOf(usePathname())}
          onSignOut={() => setDeconnexion(true)}
          onInstall={installation.proposee ? installation.lancer : undefined}
        />
      </div>
      {/* Le menu a disparu quand la fenêtre se ferme : le focus revient au rond de profil. */}
      <LogoutDialog open={deconnexion} onOpenChange={setDeconnexion} returnFocus={() => profil.current?.querySelector("button")} />
      {/* iPhone, iPad : « Installer l'application » ouvre la marche à suivre (Partager › Sur l'écran d'accueil). */}
      <AideInstallationIos open={installation.aideIos} onOpenChange={installation.setAideIos} returnFocus={() => profil.current?.querySelector("button")} />
    </>
  );
}
