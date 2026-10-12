"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { IDLE } from "@/lib/auth/schemas";
import { updatePhoto } from "@/lib/profile/actions";
import { checkPhotoFile, PHOTO_ECHEC, PHOTO_MAX_OCTETS, PHOTO_TROP_LOURDE } from "@/lib/profile/photo";
import { resizePhoto } from "@/lib/profile/resize-photo";

/** Photo et « Changer la photo » (NdProfil). La photo est réduite dans le navigateur avant l'envoi. */
export function PhotoPicker({ initials, photoUrl, name }: { initials: string; photoUrl: string | null; name: string }) {
  const { toast } = useToast();
  const champ = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  const choisir = (event: ChangeEvent<HTMLInputElement>) => {
    const fichier = event.target.files?.[0];
    // Permet de choisir à nouveau le même fichier.
    event.target.value = "";
    if (!fichier) return;
    const refus = checkPhotoFile(fichier);
    if (refus) {
      setErreur(refus);
      return;
    }
    setErreur(null);
    demarrer(async () => {
      const reduite = await resizePhoto(fichier);
      if (reduite.size > PHOTO_MAX_OCTETS) {
        setErreur(PHOTO_TROP_LOURDE);
        return;
      }
      const donnees = new FormData();
      donnees.set("photo", reduite);
      try {
        const resultat = await updatePhoto(IDLE, donnees);
        if (resultat.status === "success") toast({ tone: "reussite", title: "Photo mise à jour" });
        else setErreur(resultat.message ?? PHOTO_ECHEC);
      } catch {
        // Coupure réseau pendant l'envoi : on le dit, au lieu de l'écran d'erreur.
        setErreur(PHOTO_ECHEC);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar initials={initials} src={photoUrl} size={64} name={name} />
      <div className="flex min-w-0 flex-col gap-1.5">
        <Button type="button" variant="contour" size="sm" className="self-start" loading={envoi} onClick={() => champ.current?.click()}>
          Changer la photo
        </Button>
        <input ref={champ} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={choisir} />
        {erreur ? (
          <span role="alert" className="text-xs leading-[18px] text-erreur-texte">
            {erreur}
          </span>
        ) : (
          <span className="text-xs leading-[18px] text-discret">JPG ou PNG, 2 Mo maximum.</span>
        )}
      </div>
    </div>
  );
}
