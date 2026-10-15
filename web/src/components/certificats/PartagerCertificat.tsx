"use client";

import { useId } from "react";
import { Copy01Icon, Download04Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { adresseVerification } from "@/lib/certificats/adresse";

/**
 * « Partager votre certificat » (NdCertificatPartage) : le lien de vérification à copier, le PDF, ou un e-mail tout prêt
 * (ouvert dans la messagerie de l'appareil : rien ne part sans l'étudiant).
 */
export function PartagerCertificat({ identifiant, formation, open, onOpenChange }: { identifiant: string; formation: string; open: boolean; onOpenChange: (ouvert: boolean) => void }) {
  const id = useId();
  const { toast } = useToast();
  const lien = adresseVerification(identifiant);
  const courriel = `mailto:?subject=${encodeURIComponent(`Mon certificat Étudium : ${formation}`)}&body=${encodeURIComponent(`Vous pouvez vérifier mon certificat ici : ${lien}`)}`;

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien);
      toast({ tone: "reussite", title: "Lien copié" });
    } catch {
      toast({ tone: "erreur", title: "Le lien n’a pas pu être copié : sélectionnez-le pour le copier." });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Partager votre certificat"
      description="Toute personne disposant du lien peut vérifier son authenticité."
      footer={
        <Button variant="contour" onClick={() => onOpenChange(false)}>
          Fermer
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-lien`} className="text-sm leading-5 font-medium text-encre">
            Lien de vérification
          </label>
          <div className="flex gap-2">
            <TextInput id={`${id}-lien`} readOnly value={lien} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
            <Button variant="contour" iconLeft={Copy01Icon} onClick={() => void copier()}>
              Copier
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/certificats/${identifiant}/pdf`} className={buttonVariants({ variant: "contour", size: "sm" })}>
            <Icon icon={Download04Icon} size={16} />
            <span>Télécharger le PDF</span>
          </a>
          <a href={courriel} className={buttonVariants({ variant: "contour", size: "sm" })}>
            <Icon icon={Mail01Icon} size={16} />
            <span>Envoyer par e-mail</span>
          </a>
        </div>
      </div>
    </Dialog>
  );
}
