"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { SidebarGroup } from "@/components/ui/SidebarGroup";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { cn } from "@/lib/cn";
import { NAV_MON_ESPACE, NAV_PRINCIPALE, isActive, type NavEntry } from "@/lib/navigation";

/** Les entrées de la barre latérale ; `pathname` absent (rendu préalable) = aucune entrée active. */
export function SidebarNavLinks({ pathname, className }: { pathname: string | null; className?: string }) {
  const entree = (e: NavEntry) => (
    <SidebarItem key={e.href} href={e.href} icon={e.icon} label={e.label} active={pathname !== null && isActive(pathname, e.href)} />
  );
  return (
    <nav
      aria-label="Navigation principale"
      className={cn("box-border flex shrink grow-0 basis-[337px] flex-col gap-3 pt-5 pr-[18px] pb-5 pl-5", className)}
    >
      <SidebarGroup>{NAV_PRINCIPALE.map(entree)}</SidebarGroup>
      <SidebarGroup title="Mon espace">{NAV_MON_ESPACE.map(entree)}</SidebarGroup>
    </nav>
  );
}

function SidebarNavActive({ className }: { className?: string }) {
  return <SidebarNavLinks pathname={usePathname()} className={className} />;
}

/**
 * Barre latérale de l'espace connecté (NdAccueil) : 337 px, entrée de la page courante en pastille blanche.
 * L'adresse n'est pas toujours connue au rendu préalable (Cache Components) : la barre s'affiche d'abord
 * sans entrée active, puis la marque.
 */
export function SidebarNav({ className }: { className?: string }) {
  return (
    <Suspense fallback={<SidebarNavLinks pathname={null} className={className} />}>
      <SidebarNavActive className={className} />
    </Suspense>
  );
}
