"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { BottomBar } from "@/components/ui/BottomBar";
import { NAV_BAS, isActive } from "@/lib/navigation";

/** Les onglets de la barre du bas ; `pathname` absent (rendu préalable) = aucun onglet actif. */
export function BottomNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <BottomBar items={NAV_BAS.map((e) => ({ ...e, active: pathname !== null && isActive(pathname, e.href) }))} className="rounded-t-none" />
  );
}

function BottomNavActive() {
  return <BottomNavLinks pathname={usePathname()} />;
}

/** Barre du bas du téléphone (NdMobAccueil), sans onglet actif tant que l'adresse n'est pas connue. */
export function MobileNav() {
  return (
    <Suspense fallback={<BottomNavLinks pathname={null} />}>
      <BottomNavActive />
    </Suspense>
  );
}
