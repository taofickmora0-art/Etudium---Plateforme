"use client";

import { useRouter } from "next/navigation";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Confirmation de déconnexion (NdDeconnexion, NdMobDeconnexion).
 * Tant que la connexion n'existe pas (tâche 0.4), confirmer ramène simplement à la page de départ.
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
  const router = useRouter();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Logout03Icon}
      title="Se déconnecter ?"
      description="Votre progression est enregistrée. Vous devrez saisir à nouveau vos identifiants pour revenir."
      confirmLabel="Se déconnecter"
      returnFocus={returnFocus}
      onConfirm={() => router.push("/")}
    />
  );
}
