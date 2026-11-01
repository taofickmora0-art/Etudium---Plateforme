"use client";

import { Logout03Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { signOut } from "@/lib/auth/actions";
import { desabonnerPush } from "@/lib/envois/abonnement-push";
import { retirerAppareil } from "@/lib/envois/actions";
import { loadFullPage } from "@/lib/full-page";

/**
 * Ferme la session, puis recharge entièrement la page de connexion : rien du compte ne reste en mémoire.
 * Avant, cet appareil cesse de recevoir les notifications push du compte (appareil partagé, téléphone prêté).
 */
async function seDeconnecter() {
  try {
    const adresse = await desabonnerPush();
    if (adresse) await retirerAppareil(adresse);
  } catch {
    // La déconnexion passe avant : un appareil resté en base disparaît au premier envoi refusé.
  }
  await signOut();
  loadFullPage("/connexion");
}

/**
 * Confirmation de déconnexion (NdDeconnexion, NdMobDeconnexion).
 * Si la base ne répond pas, la fenêtre reste ouverte et le dit.
 */
export function LogoutDialog({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Élément qui reprend le focus à la fermeture (le rond de profil, quand la fenêtre s'ouvre depuis son menu). */
  returnFocus?: () => HTMLElement | null | undefined;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Logout03Icon}
      title="Se déconnecter ?"
      description="Votre progression est enregistrée. Vous devrez saisir à nouveau vos identifiants pour revenir."
      confirmLabel="Se déconnecter"
      returnFocus={returnFocus}
      onConfirm={seDeconnecter}
    />
  );
}
