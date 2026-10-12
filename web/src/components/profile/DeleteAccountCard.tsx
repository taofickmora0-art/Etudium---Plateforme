"use client";

import { useState } from "react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { TypedConfirmDialog } from "@/components/ui/TypedConfirmDialog";
import { loadFullPage } from "@/lib/full-page";
import { deleteAccount } from "@/lib/profile/actions";

/** Ferme le compte, puis recharge entièrement la page de connexion, qui confirme la suppression. */
async function supprimer() {
  await deleteAccount();
  loadFullPage("/connexion?compte=supprime");
}

/** « Supprimer mon compte » (NdProfil, NdProfilSuppression) : confirmation en saisissant SUPPRIMER. */
export function DeleteAccountCard() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <div className="flex flex-col gap-3.5 rounded-carte border border-bordure-carte bg-panneau p-5">
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-base leading-6 font-semibold text-encre">Supprimer mon compte</h3>
        <p className="m-0 text-[13px] leading-5 text-pretty text-discret">
          Cette action est définitive. Vos formations, votre progression et vos certificats seront supprimés.
        </p>
      </div>
      <Button variant="dangerDoux" className="self-start" onClick={() => setOuvert(true)}>
        Supprimer mon compte
      </Button>
      <TypedConfirmDialog
        open={ouvert}
        onOpenChange={setOuvert}
        confirmWord="SUPPRIMER"
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer votre compte ?"
        description="Cette action est définitive. Vos informations, vos formations et votre progression seront supprimées."
        confirmLabel="Supprimer mon compte"
        onConfirm={supprimer}
      />
    </div>
  );
}
