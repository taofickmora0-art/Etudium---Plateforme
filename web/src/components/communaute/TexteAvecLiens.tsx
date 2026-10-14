import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { decouperLiens } from "@/lib/communaute/liens";

/**
 * Un texte de la communauté dont chaque adresse devient un lien (spec du fil « Actualités », §3) : nouvel onglet, sans
 * transmettre la page d'origine ni recommander le site (`noopener nofollow ugc`).
 */
export function TexteAvecLiens({ texte, className }: { texte: string; className?: string }) {
  return (
    <p className={cn("m-0 whitespace-pre-line text-pretty wrap-anywhere", className)}>
      {decouperLiens(texte).map((morceau, i) =>
        "lien" in morceau ? (
          <a key={i} href={morceau.lien} target="_blank" rel="noopener nofollow ugc" className="focus-etudium break-all text-bleu underline-offset-2 hover:underline">
            {morceau.lien}
          </a>
        ) : (
          <Fragment key={i}>{morceau.texte}</Fragment>
        ),
      )}
    </p>
  );
}
