import type { ReactNode } from "react";
import Link from "next/link";
import { Video01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile } from "@/components/ui/IconTile";
import { Tag } from "@/components/ui/Tag";
import type { Espace, MembreActif } from "@/lib/communaute/types";
import { dateSession } from "@/lib/sessions/regles";
import type { ProchaineSession } from "@/lib/sessions/types";
import { tonAvatar, tonEspace } from "./outils";

const LIEN = "focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-5 pt-5 pb-2">
      <h2 className="m-0 text-base leading-6 font-semibold text-encre">{titre}</h2>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

/**
 * La colonne de droite (design NdCommunaute ; spec, §3) : la prochaine session live et les membres actifs de la
 * semaine. « À la une » et « Challenge du mois » attendent les mots-clés et les challenges.
 */
export function ColonneCommunaute({ session, membres, espaces }: { session: ProchaineSession | null; membres: MembreActif[]; espaces: Espace[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Bloc titre="Prochaine session">
        {session ? (
          <>
            <div className="flex min-h-12 items-center gap-3.5 px-1 py-3.5">
              <IconTile icon={Video01Icon} tone="information" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] leading-[22px] font-medium wrap-anywhere text-encre">{session.titre}</span>
                <span className="text-[13px] leading-5 text-discret">{dateSession(session.debut)}</span>
              </span>
            </div>
            <div className="pb-3 pl-1">
              <Link href="/evenements" className={LIEN}>
                Voir la session
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 px-1 pt-2 pb-3">
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune session programmée pour l’instant.</p>
            <Link href="/evenements" className={LIEN}>
              Voir les événements
            </Link>
          </div>
        )}
      </Bloc>
      <Bloc titre="Membres actifs">
        {membres.length === 0 ? (
          <p className="m-0 px-1 pt-2 pb-3 text-sm leading-[22px] text-discret">Aucun membre actif cette semaine.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte">
            {membres.map((m, i) => (
              <li key={`${m.nomCourt}-${i}`} className="flex min-h-12 items-center gap-3.5 px-1 py-3.5">
                <Avatar initials={m.initiales} tone={tonAvatar(m.nomCourt)} />
                <span className="min-w-0 flex-1 truncate text-[15px] leading-[22px] font-medium text-encre">{m.nomCourt}</span>
                <Tag tone={tonEspace(m.espace, espaces)}>{m.espace}</Tag>
              </li>
            ))}
          </ul>
        )}
      </Bloc>
    </div>
  );
}
