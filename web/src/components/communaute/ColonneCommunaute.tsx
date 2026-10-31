import type { ReactNode } from "react";
import Link from "next/link";
import { Video01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { IconTile } from "@/components/ui/IconTile";
import { texteBrut } from "@/lib/communaute/mise-en-forme";
import { CHEMINS_COMMUNAUTE, type EspaceCommunaute } from "@/lib/communaute/chemins";
import { moment } from "@/lib/communaute/regles";
import type { Activite, Tendance } from "@/lib/communaute/types";
import { QuandSession } from "@/components/sessions/QuandSession";
import type { ProchaineSession } from "@/lib/sessions/types";
import { extraitCourt, tonAvatar } from "./outils";

const LIEN = "focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";
const LIGNE = "focus-etudium flex min-w-0 items-start gap-3 rounded-champ px-1 py-3 text-inherit no-underline transition-colors hover:bg-page";
const LISTE = "m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte";

function Bloc({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-5 pt-5 pb-2.5 max-sm:px-4 max-sm:pt-4">
      <h2 className="m-0 text-base leading-6 font-semibold text-encre max-sm:text-[15px]">{titre}</h2>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

const Attente = ({ children }: { children: ReactNode }) => <p className="m-0 px-1 pt-2 pb-3 text-sm leading-[22px] text-discret">{children}</p>;

/**
 * La colonne de droite (design NdCommunaute ; spec du fil « Actualités », §5) : les publications tendances de la semaine,
 * les activités récentes et la prochaine session live. Avant la migration 0021 (`null`), la prochaine session seule.
 */
export function ColonneCommunaute({
  session,
  tendances,
  activites,
  maintenant,
  espace = "etudiant",
}: {
  session: ProchaineSession | null;
  tendances: Tendance[] | null;
  activites: Activite[] | null;
  maintenant: Date;
  /** Dans l'espace formateur (restructuration R1) : ses adresses, et pas de prochaine session (pas de page Événements). */
  espace?: EspaceCommunaute;
}) {
  const chemins = CHEMINS_COMMUNAUTE[espace];
  return (
    <aside aria-label="Autour de la communauté" className="flex min-w-0 flex-col gap-4">
      {tendances && (
        <Bloc titre="Publications tendances">
          {tendances.length === 0 ? (
            <Attente>Aucune publication tendance cette semaine.</Attente>
          ) : (
            <ul className={LISTE}>
              {tendances.map((t) => (
                <li key={t.id}>
                  <Link href={chemins.publication(t.id)} className={LIGNE}>
                    {/* L'équipe garde son « É » ; un membre, sa photo (0040) ou ses initiales. */}
                    <Avatar initials={t.auteur.equipe ? "É" : t.auteur.initiales} tone={t.auteur.equipe ? "bleu" : tonAvatar(t.auteur.nomCourt)} src={t.auteur.equipe ? null : t.auteur.photoUrl} />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="line-clamp-3 text-sm leading-[21px] wrap-anywhere text-encre">{texteBrut(t.extrait)}</span>
                      <span className="text-xs leading-[17px] text-discret">{t.auteur.nomCourt}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      )}
      {activites && (
        <Bloc titre="Activités récentes">
          {activites.length === 0 ? (
            <Attente>Aucune activité pour l’instant.</Attente>
          ) : (
            <ul className={LISTE}>
              {activites.map((a, i) => (
                <li key={`${a.publicationId}-${a.creeLe}-${i}`}>
                  <Link href={chemins.publication(a.publicationId)} className={LIGNE}>
                    <Avatar initials={a.auteur.initiales} tone={tonAvatar(a.auteur.nomCourt)} src={a.auteur.photoUrl} />
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <span className="text-sm leading-[21px] wrap-anywhere text-texte">
                        <strong className="font-semibold text-encre">{a.auteur.nomCourt}</strong> {a.type === "commentaire" ? "a commenté" : "a publié"} « {extraitCourt(texteBrut(a.extrait))} »
                      </span>
                      <span className="text-xs leading-[17px] font-medium text-bleu">{moment(a.creeLe, maintenant)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      )}
      {chemins.evenements && (
      <Bloc titre="Prochaine session">
        {session ? (
          <>
            <div className="flex min-h-12 items-center gap-3.5 px-1 py-3.5">
              <IconTile icon={Video01Icon} tone="information" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] leading-[22px] font-medium wrap-anywhere text-encre max-sm:text-sm max-sm:leading-5">{session.titre}</span>
                <span className="text-[13px] leading-5 text-discret max-sm:text-xs"><QuandSession debut={session.debut} /></span>
              </span>
            </div>
            <div className="pb-3 pl-1">
              <Link href={chemins.evenements} className={LIEN}>
                Voir la session
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2 px-1 pt-2 pb-3">
            <p className="m-0 text-sm leading-[22px] text-discret">Aucune session programmée pour l’instant.</p>
            <Link href={chemins.evenements} className={LIEN}>
              Voir les événements
            </Link>
          </div>
        )}
      </Bloc>
      )}
    </aside>
  );
}
