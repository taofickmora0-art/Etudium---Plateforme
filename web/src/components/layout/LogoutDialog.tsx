"use client";

import { unstable_rethrow } from "next/navigation";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { signOut } from "@/lib/auth/actions";

/**
 * L'action redirige vers la connexion ; Next fait alors échouer l'appel avec une « erreur de redirection »
 * alors que tout s'est bien passé et que la navigation est en cours. Seule une vraie erreur est remontée.
 */
async function seDeconnecter() {
  try {
    await signOut();
  } catch (error) {
    try {
      unstable_rethrow(error);
    } catch {
      return;
    }
    throw error;
  }
}

/**
 * Confirmation de déconnexion (NdDeconnexion, NdMobDeconnexion).
 * Confirmer ferme la session de cet appareil et ramène à la connexion.
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
