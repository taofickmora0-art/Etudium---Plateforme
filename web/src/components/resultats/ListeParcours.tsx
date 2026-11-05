"use client";

import { useState } from "react";
import Link from "next/link";
import { Add01Icon, Mortarboard02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { formaterNombre, pluriel } from "@/lib/resultats/affichage";
import { formaterNote, resultatParcours } from "@/lib/resultats/calcul";
import type { ParcoursComplet } from "@/lib/resultats/types";
import { FenetreParcours } from "./FenetreParcours";
import { SecuriteResultats } from "./SecuriteResultats";

/** Les parcours du compte (la licence, puis le master…) : la moyenne générale et les crédits de chacun. */
export function ListeParcours({ parcours, pin }: { parcours: ParcoursComplet[]; pin: boolean }) {
  const [creation, setCreation] = useState(false);
  const bouton = (
    <Button iconLeft={Add01Icon} onClick={() => setCreation(true)}>
      Nouveau parcours
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap justify-end gap-2">
        <SecuriteResultats pin={pin} />
        {parcours.length > 0 && bouton}
      </div>
      {parcours.length === 0 ? (
        <EmptyState
          icon={Mortarboard02Icon}
          title="Crée ton premier parcours"
          description="Ton cursus (« Licence en agronomie »), ses semestres, ses UE et tes notes."
          action={bouton}
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 max-md:grid-cols-1">
          {parcours.map((p) => {
            const bilan = resultatParcours(p);
            const provisoire = bilan.semestres.some((s) => s.provisoire);
            return (
              <li key={p.parcours.id} className="min-w-0">
                <Link
                  href={`/mes-resultats/${p.parcours.id}`}
                  className="focus-etudium flex h-full flex-col gap-3.5 rounded-carte border border-bordure-carte bg-panneau p-5 transition-colors hover:border-bleu max-sm:p-4"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <IconTile icon={Mortarboard02Icon} tone="information" />
                    <span className="min-w-0">
                      <span className="block truncate text-base leading-6 font-semibold text-encre">{p.parcours.nom}</span>
                      {p.parcours.etablissement && <span className="block truncate text-sm leading-5 text-discret">{p.parcours.etablissement}</span>}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-5 gap-y-1 text-sm leading-[22px] text-texte">
                    <span>
                      Moyenne générale <strong className="font-semibold">{bilan.moyenne === null ? "—" : formaterNote(bilan.moyenne)}</strong>
                      {provisoire && <span className="text-discret"> (provisoire)</span>}
                    </span>
                    <span>{`${formaterNombre(bilan.creditsAcquis)} / ${formaterNombre(bilan.credits)} crédits`}</span>
                    <span className="text-discret">{pluriel(p.semestres.length, "semestre")}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {creation && <FenetreParcours onFermer={() => setCreation(false)} />}
    </div>
  );
}
