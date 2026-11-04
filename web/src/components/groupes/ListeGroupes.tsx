"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { VolumeMute01Icon } from "@hugeicons/core-free-icons";
import { useMaintenant } from "@/components/notifications/horloge";
import { suivreGroupes, useTempsReelGroupes } from "@/components/temps-reel/groupes";
import { correspond, EnteteVolet } from "@/components/ui/DeuxVolets";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { chargerMesGroupes } from "@/lib/groupes/actions";
import { apercuDernier, CHEMINS_GROUPES, momentListe } from "@/lib/groupes/regles";
import type { EspaceGroupes, ResumeGroupe } from "@/lib/groupes/types";
import { cn } from "@/lib/cn";
import { TuileGroupe } from "./TuileGroupe";

const RELECTURE_MS = 1_000;

/** Une ligne de la liste : la pastille du groupe, son nom, son dernier message et l'heure, les non-lus ; l'ouvert surligné. */
function LigneGroupe({ groupe: g, espace, maintenant, ouvert }: { groupe: ResumeGroupe; espace: EspaceGroupes; maintenant: Date; ouvert: boolean }) {
  const nonLus = g.actif && g.nonLus > 0 && !ouvert;
  const libelleNonLus = g.nonLus >= 100 ? "99+" : String(g.nonLus);
  return (
    <li>
      <Link
        href={CHEMINS_GROUPES[espace].groupe(g.slug)}
        aria-current={ouvert ? "page" : undefined}
        className={cn(
          "focus-etudium flex min-w-0 items-center gap-3 rounded-carte px-3 py-3 text-texte no-underline transition-colors max-sm:gap-2.5 max-sm:px-2.5 max-sm:py-2.5",
          ouvert ? "bg-bleu-clair" : "hover:bg-page",
        )}
      >
        <TuileGroupe type={g.type} couleur={g.couleur} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm max-sm:leading-5">{g.nom}</span>
            {g.coupe && (
              <span className="flex flex-none text-discret">
                <Icon icon={VolumeMute01Icon} size={16} />
                <span className="sr-only">(notifications coupées)</span>
              </span>
            )}
            {!g.actif && <Tag tone="enAttente">Désactivé</Tag>}
            {g.dernier && <span className="ml-auto flex-none text-xs leading-[18px] text-discret">{momentListe(g.dernier.creeLe, maintenant)}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-sm leading-5 max-sm:text-[13px]", nonLus ? "font-medium text-texte" : "text-discret")}>
              {g.dernier ? apercuDernier(g.dernier) : "Aucun message pour l’instant"}
            </span>
            {nonLus && (
              <span className={cn("inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums", g.coupe ? "bg-coque text-texte" : "bg-bleu text-white")}>
                <span aria-hidden="true">{libelleNonLus}</span>
                <span className="sr-only">{`${libelleNonLus} message${g.nonLus > 1 ? "s" : ""} non lu${g.nonLus > 1 ? "s" : ""}`}</span>
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Section({ titre, groupes, espace, maintenant, ouvert }: { titre: string; groupes: ResumeGroupe[]; espace: EspaceGroupes; maintenant: Date; ouvert: string | null }) {
  const id = `groupes-${titre.replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h2 id={id} className="m-0 px-3 pt-1 text-xs leading-[18px] font-medium tracking-[0.04em] text-discret uppercase">
        {titre}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {groupes.map((g) => (
          <LigneGroupe key={g.id} groupe={g} espace={espace} maintenant={maintenant} ouvert={g.slug === ouvert} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Le volet de gauche des « Groupes » (spec des groupes, §2 ; deux volets, 4 novembre 2026) : le titre, une recherche
 * par nom, le Général et les groupes des parcours, puis, à part, ceux des formations (« Mes formations »). Chacun avec
 * son dernier message (auteur, extrait, heure) et ses non-lus, tenus à jour par le temps réel ; le groupe ouvert est
 * surligné.
 */
export function ListeGroupes({ espace, initiaux }: { espace: EspaceGroupes; initiaux: ResumeGroupe[] }) {
  const maintenant = useMaintenant();
  const chemin = usePathname();
  const [groupes, setGroupes] = useState(initiaux);
  const [recherche, setRecherche] = useState("");
  const prevue = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cle = groupes.filter((g) => g.actif).map((g) => g.id).join(",");
  const prefixe = `${CHEMINS_GROUPES[espace].liste}/`;
  const ouvert = chemin?.startsWith(prefixe) ? decodeURIComponent(chemin.slice(prefixe.length).split("/")[0]) : null;

  useEffect(() => {
    suivreGroupes("liste", cle ? cle.split(",") : []);
    return () => suivreGroupes("liste", []);
  }, [cle]);
  useEffect(() => () => {
    if (prevue.current) clearTimeout(prevue.current);
  }, []);

  // Un message ou un changement dans l'un d'eux : la liste se relit (une seule fois pour plusieurs événements proches).
  useTempsReelGroupes(() => {
    if (prevue.current) return;
    prevue.current = setTimeout(() => {
      prevue.current = null;
      void chargerMesGroupes().then((r) => {
        if (r.ok) setGroupes(r.groupes);
      });
    }, RELECTURE_MS);
  });

  const affiches = recherche.trim() ? groupes.filter((g) => correspond(g.nom, recherche)) : groupes;
  const communs = affiches.filter((g) => g.type !== "formation");
  const formations = affiches.filter((g) => g.type === "formation");
  return (
    <>
      <EnteteVolet titre="Groupes" recherche={recherche} onRecherche={setRecherche} placeholder="Rechercher un groupe" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 pb-3">
        {communs.length > 0 && <Section titre="Groupes" groupes={communs} espace={espace} maintenant={maintenant} ouvert={ouvert} />}
        {formations.length > 0 && <Section titre="Mes formations" groupes={formations} espace={espace} maintenant={maintenant} ouvert={ouvert} />}
        {affiches.length === 0 && (
          <p className="m-0 px-3 py-6 text-center text-sm leading-[22px] text-discret">
            {recherche.trim() ? `Aucun groupe ne correspond à « ${recherche.trim()} ».` : "Aucun groupe pour l’instant."}
          </p>
        )}
      </div>
    </>
  );
}
