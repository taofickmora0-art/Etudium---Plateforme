"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Time02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/** « Votre session a expiré » (NdSessionExpiree), par-dessus la connexion : se ferme seulement par « Se reconnecter ». */
export function SessionExpiredDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const fermer = () => {
    setOpen(false);
    router.replace("/connexion");
  };
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      dismissible={false}
      icon={Time02Icon}
      title="Votre session a expiré"
      description="Par sécurité, reconnectez-vous pour continuer. Votre progression est enregistrée."
      footer={<Button onClick={fermer}>Se reconnecter</Button>}
    />
  );
}
