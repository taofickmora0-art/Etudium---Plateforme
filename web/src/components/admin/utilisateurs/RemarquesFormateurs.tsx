import type { RemarqueFormateur } from "@/lib/utilisateurs/types";
import { dateCourte } from "@/lib/utilisateurs/regles";
import { Section } from "./Section";

/**
 * Les remarques privées des formateurs sur ce compte (spec « Étudiants », §3), en lecture seule pour l'équipe.
 * Null (avant la migration 0015) : la section n'apparaît pas.
 */
export function RemarquesFormateurs({ remarques }: { remarques: RemarqueFormateur[] | null }) {
  if (remarques === null) return null;
  return (
    <Section titre="Remarques des formateurs">
      {remarques.length === 0 ? (
        <p className="m-0 text-sm leading-[22px] text-discret">Aucune remarque.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {remarques.map((r) => (
            <li key={`${r.formateurNom}-${r.modifieeLe}`} className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] leading-5 text-discret">{`${r.formateurNom} · ${dateCourte(r.modifieeLe)}`}</span>
              <p className="m-0 text-sm leading-[22px] break-words whitespace-pre-line text-texte">{r.texte}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
