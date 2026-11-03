"use client";

import { Fragment, Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SidebarGroup } from "@/components/ui/SidebarGroup";
import { useGroupesNonLus } from "@/components/groupes/useGroupesNonLus";
import { useMessagesNonLus } from "@/components/messages/useMessagesNonLus";
import { useNouvellesSessions } from "@/components/sessions/useNouvellesSessions";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { useDomaines } from "@/lib/auth/domaines-du-compte";
import { spaceOf, type Espace } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { MENUS, entreeActive, filtrerGroupes, type NavEntry } from "@/lib/navigation";

// La barre garde toujours 337 px de contenu : réduite, sa place n'en montre que la colonne d'icônes (84 px), sans se
// déplier au survol ni au clavier : on la rouvre avec son bouton (règles « menu-lateral » de globals.css).
const NAV = "box-border flex w-[337px] flex-col gap-3 pt-5 pr-[18px] pb-5 pl-5";

/**
 * Les entrées de la barre latérale, celles de l'espace où l'on se trouve (étudiant, formateur, back-office).
 * `pathname` absent (rendu préalable) : aucune entrée active, et le menu de `espace` s'il est connu ; sinon la barre
 * reste vide un instant plutôt que d'afficher le menu d'un autre espace.
 */
export function SidebarNavLinks({
  pathname,
  espace,
  className,
  repliable = true,
  apresPremierGroupe,
}: {
  pathname: string | null;
  espace?: Espace;
  className?: string;
  /** Faux dans le tiroir du téléphone : ni colonne d'icônes, ni identifiant de la barre de l'ordinateur. */
  repliable?: boolean;
  /** Un groupe glissé après le premier (les espaces de la communauté, dans le tiroir). */
  apresPremierGroupe?: ReactNode;
}) {
  const actuel = pathname !== null ? spaceOf(pathname) : espace;
  const menu = actuel ? MENUS[actuel] : null;
  // Le back-office : seulement les entrées des domaines du compte (lot 6 A).
  const domaines = useDomaines();
  const groupesVisibles = menu ? (actuel === "admin" ? filtrerGroupes(menu.groupes, domaines) : menu.groupes) : [];
  // La pastille rouge des nouvelles sessions live, sur l'entrée Événements de l'espace étudiant.
  const nouvelles = useNouvellesSessions(pathname, actuel === "etudiant");
  // Les conversations non lues, sur l'entrée « Messages » de l'espace (l'équipe : l'assistance).
  const espaceMessages = actuel === "admin" ? "equipe" : (actuel ?? null);
  const nonLus = useMessagesNonLus(espaceMessages, pathname !== null);
  // Les messages non lus des groupes (0075), sur l'entrée « Groupes » de l'étudiant et du formateur.
  const nonLusGroupes = useGroupesNonLus(pathname !== null && actuel !== "admin" && actuel !== undefined);
  const pastilleDe = (href: string) => {
    if (href === "/evenements" && nouvelles > 0) return { nombre: nouvelles, libelle: `${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""} session${nouvelles > 1 ? "s" : ""}` };
    if ((href === "/messages" || href === "/formateur/messages" || href === "/admin/messages") && nonLus > 0) {
      return { nombre: nonLus, libelle: `${nonLus} conversation${nonLus > 1 ? "s" : ""} non lue${nonLus > 1 ? "s" : ""}` };
    }
    if ((href === "/groupes" || href === "/formateur/groupes") && nonLusGroupes > 0) {
      return { nombre: nonLusGroupes, libelle: `${nonLusGroupes} message${nonLusGroupes > 1 ? "s" : ""} non lu${nonLusGroupes > 1 ? "s" : ""} dans les groupes` };
    }
    return undefined;
  };
  const entree = (e: NavEntry) => (
    <SidebarItem
      key={e.href}
      href={e.href}
      icon={e.icon}
      label={e.label}
      active={pathname !== null && entreeActive(pathname, e)}
      pastille={pastilleDe(e.href)}
    />
  );
  const groupes = groupesVisibles.map((groupe, index) => (
    <Fragment key={groupe.titre ?? index}>
      <SidebarGroup title={groupe.titre}>{groupe.entrees.map(entree)}</SidebarGroup>
      {index === 0 && apresPremierGroupe}
    </Fragment>
  ));
  if (!repliable) {
    return (
      <nav aria-label={menu?.libelle ?? "Navigation principale"} className={cn("box-border flex w-full flex-col gap-3 px-4 pt-2 pb-6", className)}>
        {groupes}
      </nav>
    );
  }
  return (
    <div className={cn("menu-lateral-place relative shrink-0", className)}>
      {/* Figée quand la page défile (demande du 15 octobre 2026) ; si l'écran est trop bas pour toutes ses entrées, elle défile seule. */}
      {/* Juste sous l'en-tête, lui aussi figé (31 octobre) : à sa hauteur mesurée (--entete-app, MesureEntete). */}
      <div className="menu-lateral sticky top-[var(--entete-app)] z-20 max-h-[calc(100dvh-var(--entete-app))] overflow-x-hidden overflow-y-auto rounded-l-coque bg-coque [scrollbar-color:var(--color-bordure-champ)_transparent] [scrollbar-width:thin]">
        <nav id="menu-lateral" aria-label={menu?.libelle ?? "Navigation principale"} className={NAV}>
          {groupes}
        </nav>
      </div>
    </div>
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
