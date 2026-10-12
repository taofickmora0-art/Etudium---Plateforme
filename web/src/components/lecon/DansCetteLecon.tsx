import { useId } from "react";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";

/** Carte « Dans cette leçon » (NdLecon §2.12) : résumé et points clés ; rien sans l'un ni l'autre. */
export function DansCetteLecon({ resume, pointsCles }: { resume: string; pointsCles: string[] }) {
  const titre = useId();
  if (!resume && pointsCles.length === 0) return null;
  return (
    <section aria-labelledby={titre} className="box-border flex min-w-0 flex-col rounded-carte bg-page p-5">
      <h2 id={titre} className="m-0 text-base leading-6 font-semibold text-encre">
        Dans cette leçon
      </h2>
      {resume && <p className="m-0 mt-2 text-sm leading-[22px] text-pretty text-ardoise">{resume}</p>}
      {pointsCles.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          {pointsCles.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex flex-none text-reussite-texte">
                <Icon icon={Tick02Icon} size={18} />
              </span>
              <span className="text-sm leading-[22px] text-texte">{point}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
