"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BottomBar } from "@/components/ui/BottomBar";
import { spaceOf, type Espace } from "@/lib/auth/permissions";
import { NAV_BAS_PAR_ESPACE, isActive } from "@/lib/navigation";

/** Les onglets de la barre du bas, ceux de l'espace courant ; `pathname` absent (rendu préalable) = aucun onglet actif. */
export function BottomNavLinks({ pathname, espace }: { pathname: string | null; espace?: Espace }) {
  const actuel = pathname !== null ? spaceOf(pathname) : espace;
  const onglets = actuel ? NAV_BAS_PAR_ESPACE[actuel] : [];
  return (
    <BottomBar items={onglets.map((e) => ({ ...e, active: pathname !== null && isActive(pathname, e.href, e.exact) }))} className="rounded-t-none" />
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
