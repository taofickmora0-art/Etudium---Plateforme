"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import { HoverCard } from "radix-ui";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { arriveeDuFormateur } from "@/lib/formateurs/regles";
import type { ApercuFormateur } from "@/lib/formateurs/types";
import { AvatarFormateur } from "./AvatarFormateur";
import { BoutonMessageFormateur } from "./BoutonMessageFormateur";
import { ReseauxFormateur } from "./ReseauxFormateur";

/** L'adresse du profil public d'un formateur (spec du 2 novembre 2026, §6). */
export const adresseFormateur = (id: string) => `/formateurs/${id}`;

/** Le contenu de la carte : rendu seulement quand elle s'ouvre, dans le navigateur (l'heure est celle de l'appareil). */
function ContenuCarte({ formateur }: { formateur: ApercuFormateur }) {
  const [maintenant] = useState(() => new Date());
  const arrivee = arriveeDuFormateur(formateur.rejointLe, maintenant);
  return (
    <>
      <div className="flex items-center gap-3.5">
        <AvatarFormateur nom={formateur.nom} photoUrl={formateur.photoUrl} taille={64} />
        <div className="flex min-w-0 flex-col items-start gap-1.5">
          <span className="text-base leading-6 font-semibold text-encre">{formateur.nom}</span>
          <Tag tone="complementaire">Formateur</Tag>
        </div>
      </div>
      {formateur.presentation && <p className="m-0 mt-3.5 line-clamp-5 text-sm leading-[22px] text-pretty text-texte">{formateur.presentation}</p>}
      {arrivee && (
        <p className="m-0 mt-3 flex items-center gap-1.5 text-[13px] leading-5 text-discret">
          <Icon icon={Calendar03Icon} size={16} />
          <span>{arrivee}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <Button asChild variant="contour">
          <Link href={adresseFormateur(formateur.id)}>Voir le profil</Link>
        </Button>
        {formateur.peutEcrire && <BoutonMessageFormateur formateurId={formateur.id} />}
      </div>
      <ReseauxFormateur nom={formateur.nom} reseaux={formateur.reseaux} className="mt-4" />
    </>
  );
}

/**
 * Le nom d'un formateur, lien vers son profil, et sa carte au survol (spec du 2 novembre 2026, §5) : photo ou initiales,
 * nom, « Formateur », présentation, « A rejoint : il y a … », « Voir le profil », « Message » (si le compte peut lui
 * écrire) et ses réseaux. La carte ne s'ouvre qu'à la souris : au toucher ou au clavier, le nom reste un simple lien vers
 * le profil, où tout se retrouve.
 */
export function CarteFormateurSurvol({ formateur, className }: { formateur: ApercuFormateur; className?: string }) {
  return (
    <HoverCard.Root openDelay={300} closeDelay={150}>
      {/* Radix ouvre aussi la carte au focus : on l'en empêche, le clavier suit le lien. */}
      <HoverCard.Trigger asChild onFocus={(evenement) => evenement.preventDefault()}>
        <Link href={adresseFormateur(formateur.id)} className={cn("focus-etudium min-w-0 text-encre no-underline hover:underline", className)}>
          {formateur.nom}
        </Link>
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          data-carte-formateur=""
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 box-border flex w-[320px] max-w-[calc(100vw_-_32px)] flex-col rounded-carte border border-bordure-carte bg-panneau p-5 shadow-menu outline-none"
        >
          <ContenuCarte formateur={formateur} />
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
