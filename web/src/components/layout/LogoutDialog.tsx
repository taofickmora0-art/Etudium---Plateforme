"use client";

import { Logout03Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { signOut } from "@/lib/auth/actions";
import { loadFullPage } from "@/lib/full-page";

/** Ferme la session, puis recharge entièrement la page de connexion : rien du compte ne reste en mémoire. */
async function seDeconnecter() {
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
