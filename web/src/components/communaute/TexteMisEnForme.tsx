import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { decouperLiens } from "@/lib/communaute/liens";
import { analyser, type Marque, type Segment } from "@/lib/communaute/mise-en-forme";

// Les titres d'une publication restent sous celui de sa carte (h3) : niveaux 4 à 6 pour les lecteurs d'écran.
const TITRES = {
  1: { Balise: "h4", classe: "text-xl leading-7 max-sm:text-lg max-sm:leading-[26px]" },
  2: { Balise: "h5", classe: "text-lg leading-[26px] max-sm:text-base max-sm:leading-6" },
  3: { Balise: "h6", classe: "text-base leading-6 max-sm:text-[15px]" },
} as const;

function Liens({ texte }: { texte: string }) {
  return decouperLiens(texte).map((morceau, i) =>
    "lien" in morceau ? (
      <a key={i} href={morceau.lien} target="_blank" rel="noopener nofollow ugc" className="focus-etudium break-all text-bleu underline-offset-2 hover:underline">
        {morceau.lien}
      </a>
    ) : (
      <Fragment key={i}>{morceau.texte}</Fragment>
    ),
  );
}

function avecMarques(marques: Marque[], contenu: ReactNode): ReactNode {
  return marques.reduceRight<ReactNode>((dedans, m) => {
    if (m === "gras") return <strong className="font-semibold">{dedans}</strong>;
    if (m === "italique") return <em>{dedans}</em>;
    if (m === "souligne") return <u className="underline-offset-2">{dedans}</u>;
    return <s>{dedans}</s>;
  }, contenu);
}

function Segments({ segments }: { segments: Segment[] }) {
  return segments.map((s, i) => (
    <Fragment key={i}>{"saut" in s ? <br /> : avecMarques(s.marques, <Liens texte={s.texte} />)}</Fragment>
  ));
}

/**
 * Le texte d'une publication, mis en forme (spec mise en forme et vidéo, §2) : titres, gras, italique, souligné, barré,
 * listes, citation, et ses adresses en liens. Chaque élément est construit ici à partir d'une liste fermée : aucun HTML
 * venu d'un compte n'est injecté. Une ancienne publication (texte simple) s'affiche comme avant.
 */
export function TexteMisEnForme({ texte, className }: { texte: string; className?: string }) {
  return (
    <div className={cn("min-w-0 text-pretty wrap-anywhere [&>*+*]:mt-2.5", className)}>
      {analyser(texte).map((b, i) => {
        switch (b.type) {
          case "paragraphe":
            return (
              <p key={i} className="m-0">
                <Segments segments={b.segments} />
              </p>
            );
          case "titre": {
            const { Balise, classe } = TITRES[b.niveau];
            return (
              <Balise key={i} className={cn("m-0 font-semibold text-encre", classe)}>
                <Segments segments={b.segments} />
              </Balise>
            );
          }
          case "puces":
          case "numeros": {
            const Liste = b.type === "puces" ? "ul" : "ol";
            return (
              <Liste key={i} start={b.type === "numeros" ? b.debut : undefined} className={cn("m-0 pl-5", b.type === "puces" ? "list-disc" : "list-decimal")}>
                {b.elements.map((e, j) => (
                  <li key={j} className="pl-0.5">
                    <Segments segments={e} />
                  </li>
                ))}
              </Liste>
            );
          }
          case "citation":
            return (
              <blockquote key={i} className="m-0 border-l-[3px] border-bleu-bord pl-3 text-ardoise">
                <Segments segments={b.segments} />
              </blockquote>
            );
        }
      })}
    </div>
  );
}
