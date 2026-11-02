"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { ActionButton } from "@/components/ui/TopBarButtons";
import { useDomaines } from "@/lib/auth/domaines-du-compte";
import { spaceOf } from "@/lib/auth/permissions";

const CIBLES = { etudiant: "/formations", admin: "/admin/formations/nouvelle", formateur: "/formateur/formations/nouvelle" } as const;

function Bouton({ href, className }: { href: string; className?: string }) {
  return (
    <ActionButton href={href} className={className}>
      Ajouter une formation
    </ActionButton>
  );
}

function BoutonActif({ className }: { className?: string }) {
  const espace = spaceOf(usePathname());
  const domaines = useDomaines();
  // Au back-office, seulement pour qui gère les contenus (lot 6 A : pas le modérateur).
  if (espace === "admin" && !(domaines ?? []).includes("contenus")) return null;
  return <Bouton href={CIBLES[espace]} className={className} />;
}

/**
 * « Ajouter une formation » suit l'espace : le catalogue pour un étudiant, le formulaire de nouvelle formation au
 * back-office et dans l'espace formateur.
 */
export function BoutonAjouterFormation({ className }: { className?: string }) {
  return (
    <Suspense fallback={<Bouton href={CIBLES.etudiant} className={className} />}>
      <BoutonActif className={className} />
    </Suspense>
  );
}
