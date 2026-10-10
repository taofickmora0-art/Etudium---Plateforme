"use client";

import { usePathname } from "next/navigation";
import { SidebarGroup } from "@/components/ui/SidebarGroup";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { cn } from "@/lib/cn";
import { NAV_MON_ESPACE, NAV_PRINCIPALE, isActive, type NavEntry } from "@/lib/navigation";

/** Barre latérale de l'espace connecté (NdAccueil) : 337 px, entrée de la page courante en pastille blanche. */
export function SidebarNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const entree = (e: NavEntry) => <SidebarItem key={e.href} href={e.href} icon={e.icon} label={e.label} active={isActive(pathname, e.href)} />;
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
