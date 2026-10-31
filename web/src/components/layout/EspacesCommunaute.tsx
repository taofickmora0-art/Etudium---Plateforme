"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Book02Icon, Briefcase01Icon, ComputerIcon, Mortarboard02Icon, News01Icon, SquareLock02Icon, UserGroupIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { SidebarGroup } from "@/components/ui/SidebarGroup";
import { SidebarItem } from "@/components/ui/SidebarItem";
import { chargerEspaces } from "@/lib/communaute/actions";
import { CHEMINS_COMMUNAUTE, espaceCommunauteDe } from "@/lib/communaute/chemins";
import { REPLAYS, type Espace } from "@/lib/communaute/types";

const ICONES: Record<string, IconSvgElement> = { academique: Mortarboard02Icon, digital: ComputerIcon, business: Briefcase01Icon };

/**
 * Le groupe « Espaces de la communauté » du menu ≡ (design NdMobMenuOuvert ; spec du fil « Actualités », §1) :
 * Actualités, Général, puis les parcours, un cadenas sur ceux qui sont fermés au compte. Chaque entrée ouvre son onglet
 * (`/accueil?espace=…` : l'Accueil est la communauté). Les espaces sont lus à l'ouverture du tiroir ; sans eux, le groupe n'apparaît pas.
 */
export function EspacesCommunaute({ pathname }: { pathname: string }) {
  const parametres = useSearchParams();
  const [espaces, setEspaces] = useState<Espace[] | null>(null);

  useEffect(() => {
    let actif = true;
    chargerEspaces()
      .then((reponse) => {
        if (actif && reponse.ok) setEspaces(reponse.espaces);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  if (!espaces || espaces.length === 0) return null;
  // L'Accueil de l'étudiant, ou la communauté du formateur (restructuration R1).
  const racine = CHEMINS_COMMUNAUTE[espaceCommunauteDe(pathname)].accueil;
  const courant = pathname === racine ? (parametres.get("espace") ?? "tous") : null;
  const entrees = [
    { valeur: "tous", libelle: "Actualités", icone: News01Icon, ouvert: true },
    ...espaces.map((e) => ({
      valeur: e.id ?? "general",
      libelle: e.nomCourt,
      // Les replays des lives (0046) : la caméra des sessions live.
      icone: e.id === REPLAYS ? Video01Icon : e.id ? (ICONES[e.couleur ?? ""] ?? Book02Icon) : UserGroupIcon,
      ouvert: e.ouvert,
    })),
  ];
  return (
    <SidebarGroup title="Espaces de la communauté">
      {entrees.map((e) => (
        <SidebarItem
          key={e.valeur}
          href={`${racine}?espace=${encodeURIComponent(e.valeur)}`}
          icon={e.icone}
          label={e.libelle}
          active={courant === e.valeur}
          fin={
            e.ouvert ? undefined : (
              <>
                <span className="sr-only">, espace verrouillé</span>
                <Icon icon={SquareLock02Icon} size={18} className="text-discret" />
              </>
            )
          }
        />
      ))}
    </SidebarGroup>
  );
}
