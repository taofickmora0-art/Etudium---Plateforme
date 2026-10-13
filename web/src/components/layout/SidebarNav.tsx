"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { SidebarGroup } from "@/components/ui/SidebarGroup";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { spaceOf, type Espace } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { MENUS, isActive, type NavEntry } from "@/lib/navigation";

const NAV = "box-border flex shrink grow-0 basis-[337px] flex-col gap-3 pt-5 pr-[18px] pb-5 pl-5";

/**
 * Les entrées de la barre latérale, celles de l'espace où l'on se trouve (étudiant, formateur, back-office).
 * `pathname` absent (rendu préalable) : aucune entrée active, et le menu de `espace` s'il est connu ; sinon la barre
 * reste vide un instant plutôt que d'afficher le menu d'un autre espace.
 */
export function SidebarNavLinks({ pathname, espace, className }: { pathname: string | null; espace?: Espace; className?: string }) {
  const actuel = pathname !== null ? spaceOf(pathname) : espace;
  if (!actuel) return <nav aria-label="Navigation principale" className={cn(NAV, className)} />;
  const menu = MENUS[actuel];
  const entree = (e: NavEntry) => (
    <SidebarItem key={e.href} href={e.href} icon={e.icon} label={e.label} active={pathname !== null && isActive(pathname, e.href, e.exact)} />
  );
  return (
    <nav aria-label={menu.libelle} className={cn(NAV, className)}>
      {menu.groupes.map((groupe, index) => (
        <SidebarGroup key={groupe.titre ?? index} title={groupe.titre}>
          {groupe.entrees.map(entree)}
        </SidebarGroup>
      ))}
    </nav>
  );
}

function SidebarNavActive({ className }: { className?: string }) {
  return <SidebarNavLinks pathname={usePathname()} className={className} />;
}

/**
 * Barre latérale de l'espace connecté (NdAccueil) : 337 px, entrée de la page courante en pastille blanche.
 * L'adresse n'est pas toujours connue au rendu préalable (Cache Components) : la barre s'affiche d'abord
 * sans entrée active (avec le menu de `espace` s'il est connu), puis la marque.
 */
export function SidebarNav({ className, espace }: { className?: string; espace?: Espace }) {
  return (
    <Suspense fallback={<SidebarNavLinks pathname={null} espace={espace} className={className} />}>
      <SidebarNavActive className={className} />
    </Suspense>
  );
}
