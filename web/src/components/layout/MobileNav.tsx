"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BottomBar } from "@/components/ui/BottomBar";
import { useDomaines } from "@/lib/auth/domaines-du-compte";
import { spaceOf, type Espace } from "@/lib/auth/permissions";
import { NAV_BAS_PAR_ESPACE, entreeActive, filtrerEntrees } from "@/lib/navigation";

/** Les onglets de la barre du bas, ceux de l'espace courant ; `pathname` absent (rendu préalable) = aucun onglet actif. */
export function BottomNavLinks({ pathname, espace }: { pathname: string | null; espace?: Espace }) {
  const actuel = pathname !== null ? spaceOf(pathname) : espace;
  const domaines = useDomaines();
  const tous = actuel ? NAV_BAS_PAR_ESPACE[actuel] : [];
  // Le back-office : seulement les onglets des domaines du compte (lot 6 A).
  const onglets = actuel === "admin" ? filtrerEntrees(tous, domaines) : tous;
  return (
    <BottomBar items={onglets.map((e) => ({ ...e, active: pathname !== null && entreeActive(pathname, e) }))} className="rounded-t-none" />
  );
}

function BottomNavActive() {
  return <BottomNavLinks pathname={usePathname()} />;
}

/** Barre du bas du téléphone (NdMobAccueil), sans onglet actif tant que l'adresse n'est pas connue. */
export function MobileNav({ espace }: { espace?: Espace }) {
  return (
    <Suspense fallback={<BottomNavLinks pathname={null} espace={espace} />}>
      <BottomNavActive />
    </Suspense>
  );
}
