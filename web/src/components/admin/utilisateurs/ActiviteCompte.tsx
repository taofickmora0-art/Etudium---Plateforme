import { ProgressBar } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import { dateCourte } from "@/lib/utilisateurs/regles";
import type { CompteDetail } from "@/lib/utilisateurs/types";
import { Section } from "./Section";

const EXTRAIT = 120;
const extrait = (texte: string) => (texte.length > EXTRAIT ? `${texte.slice(0, EXTRAIT)}…` : texte);

/** Activité d'un compte (spec des utilisateurs, §3) : formations suivies (au moins une leçon ouverte) et avis laissés. */
export function ActiviteCompte({ compte }: { compte: CompteDetail }) {
  return (
    <Section titre="Activité">
      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-[15px] leading-[22px] font-semibold text-encre">Formations suivies</h3>
        {compte.formations.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">Aucune formation commencée.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {compte.formations.map((f) => (
              <li key={f.id} className="flex min-w-0 flex-col gap-1.5">
                <span className="text-sm leading-[22px] font-medium break-words text-encre">{f.titre}</span>
                <ProgressBar value={f.total > 0 ? Math.round((f.terminees / f.total) * 100) : 0} label={`Progression de ${f.titre}`} />
                <span className="text-[13px] leading-5 text-discret">
                  {`${f.terminees} / ${f.total} leçons · Dernière activité le ${dateCourte(f.derniereActivite)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-[15px] leading-[22px] font-semibold text-encre">Avis laissés</h3>
        {compte.avis.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">Aucun avis.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {compte.avis.map((a) => (
              <li key={a.id} className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm leading-[22px] font-medium break-words text-encre">{a.formationTitre}</span>
                  <span className="text-[13px] leading-5 text-discret">{`${a.note}/5`}</span>
                  {a.masque && <Tag tone="enAttente">Masqué par l’équipe</Tag>}
                </span>
                {a.commentaire && <p className="m-0 text-[13px] leading-5 break-words text-texte">{extrait(a.commentaire)}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}
