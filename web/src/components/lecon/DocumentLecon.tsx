import { Fragment, type ReactNode } from "react";
import { Alert02Icon, BulbIcon, InformationCircleIcon, StarIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import type { DocumentLecon as Doc, MarqueDoc, NoeudDoc, TonEncadre } from "@/lib/lecon/document";
import { FOURNISSEURS, type Fournisseur } from "@/lib/video/plateformes";
import { LecteurVideo } from "./LecteurVideo";

// Le contenu riche d'une leçon (fin du lot 4, spec §1.3). Chaque élément est construit ici à partir de la liste fermée
// du format (lib/lecon/document.ts) : aucun HTML venu d'un compte n'est injecté ; un bloc inconnu ne rend rien.

const ENCADRES: Record<TonEncadre, { nom: string; boite: string; icone: string; glyphe: typeof InformationCircleIcon }> = {
  info: { nom: "Information", boite: "bg-bleu-pale text-encre", icone: "text-bleu", glyphe: InformationCircleIcon },
  astuce: { nom: "Astuce", boite: "bg-reussite-fond text-encre", icone: "text-reussite-texte", glyphe: BulbIcon },
  attention: { nom: "Attention", boite: "bg-attention-fond text-encre", icone: "text-attention-texte", glyphe: Alert02Icon },
  retenir: { nom: "À retenir", boite: "bg-premium-fond text-encre", icone: "text-premium-texte", glyphe: StarIcon },
};

function avecMarques(marques: MarqueDoc[] | undefined, contenu: ReactNode): ReactNode {
  return (marques ?? []).reduceRight<ReactNode>((dedans, m) => {
    switch (m.type) {
      case "bold":
        return <strong className="font-semibold">{dedans}</strong>;
      case "italic":
        return <em>{dedans}</em>;
      case "underline":
        return <u className="underline-offset-2">{dedans}</u>;
      case "strike":
        return <s>{dedans}</s>;
      case "link":
        // L'adresse a été vérifiée (http ou https) à l'enregistrement, puis à la lecture du document.
        return /^https?:\/\//i.test(m.attrs.href) ? (
          <a href={m.attrs.href} target="_blank" rel="noopener nofollow ugc" className="focus-etudium text-bleu underline underline-offset-2 hover:text-bleu-survol">
            {dedans}
          </a>
        ) : (
          dedans
        );
      default:
        return dedans;
    }
  }, contenu);
}

function EnLigne({ noeuds }: { noeuds?: NoeudDoc[] }) {
  return (noeuds ?? []).map((n, i) =>
    n.type === "hardBreak" ? <br key={i} /> : n.type === "text" && typeof n.text === "string" ? <Fragment key={i}>{avecMarques(n.marks, n.text)}</Fragment> : null,
  );
}

const estFournisseur = (v: unknown): v is Fournisseur => FOURNISSEURS.includes(v as Fournisseur);

function Bloc({ n, images }: { n: NoeudDoc; images: Record<string, string> }): ReactNode {
  const enfants = (n.content ?? []).map((e, i) => <Bloc key={i} n={e} images={images} />);
  switch (n.type) {
    case "paragraph":
      return (
        <p className="m-0">
          <EnLigne noeuds={n.content} />
        </p>
      );
    case "heading":
      return n.attrs?.level === 3 ? (
        <h3 className="m-0 mt-2 text-[17px] leading-6 font-semibold text-encre max-sm:text-base">
          <EnLigne noeuds={n.content} />
        </h3>
      ) : (
        <h2 className="m-0 mt-3 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">
          <EnLigne noeuds={n.content} />
        </h2>
      );
    case "bulletList":
      return <ul className="m-0 list-disc pl-5 [&>li+li]:mt-1">{enfants}</ul>;
    case "orderedList":
      return (
        <ol start={typeof n.attrs?.start === "number" ? n.attrs.start : undefined} className="m-0 list-decimal pl-5 [&>li+li]:mt-1">
          {enfants}
        </ol>
      );
    case "listItem":
      return <li className="pl-0.5 [&>*+*]:mt-1">{enfants}</li>;
    case "blockquote":
      return <blockquote className="m-0 border-l-[3px] border-bleu-bord pl-3 text-ardoise [&>*+*]:mt-2">{enfants}</blockquote>;
    case "encadre": {
      const ton = ENCADRES[n.attrs?.ton as TonEncadre];
      if (!ton) return null;
      return (
        <div role="note" aria-label={ton.nom} className={cn("flex gap-3 rounded-carte px-4 py-3.5 max-sm:px-3.5 max-sm:py-3", ton.boite)}>
          <Icon icon={ton.glyphe} size={20} className={cn("mt-0.5 flex-none", ton.icone)} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">{enfants}</div>
        </div>
      );
    }
    case "imageLecon": {
      const chemin = typeof n.attrs?.chemin === "string" ? n.attrs.chemin : "";
      const url = images[chemin];
      const alt = typeof n.attrs?.alt === "string" ? n.attrs.alt : "";
      const legende = typeof n.attrs?.legende === "string" ? n.attrs.legende : "";
      return (
        <figure className="m-0 flex flex-col gap-2">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- image privée, servie par un lien signé d'une heure
            <img src={url} alt={alt} loading="lazy" className="block h-auto max-w-full rounded-carte border border-bordure-carte" />
          ) : (
            <div className="flex h-32 items-center justify-center rounded-carte border border-dashed border-bordure-champ bg-page text-sm text-discret">Image indisponible</div>
          )}
          {legende && <figcaption className="text-[13px] leading-5 text-discret">{legende}</figcaption>}
        </figure>
      );
    }
    case "table": {
      const rangees = n.content ?? [];
      const entete = rangees[0]?.content?.length && rangees[0].content.every((c) => c.type === "tableHeader") ? rangees[0] : null;
      const corps = entete ? rangees.slice(1) : rangees;
      const rangee = (r: NoeudDoc, i: number) => (
        <tr key={i} className="border-t border-bordure-carte first:border-t-0">
          {(r.content ?? []).map((c, j) => {
            const Cellule = c.type === "tableHeader" ? "th" : "td";
            const colonnes = typeof c.attrs?.colspan === "number" && c.attrs.colspan > 1 ? c.attrs.colspan : undefined;
            const lignes = typeof c.attrs?.rowspan === "number" && c.attrs.rowspan > 1 ? c.attrs.rowspan : undefined;
            return (
              <Cellule key={j} colSpan={colonnes} rowSpan={lignes} scope={Cellule === "th" ? "col" : undefined} className={cn("px-3 py-2 text-left align-top [&>*+*]:mt-1", Cellule === "th" && "font-semibold text-encre")}>
                {(c.content ?? []).map((e, k) => (
                  <Bloc key={k} n={e} images={images} />
                ))}
              </Cellule>
            );
          })}
        </tr>
      );
      return (
        <div className="max-w-full overflow-x-auto rounded-carte border border-bordure-carte">
          <table className="w-full min-w-max border-collapse text-sm leading-[22px]">
            {entete && <thead className="bg-bleu-clair">{rangee(entete, 0)}</thead>}
            <tbody>{corps.map(rangee)}</tbody>
          </table>
        </div>
      );
    }
    case "videoLecon":
      return estFournisseur(n.attrs?.fournisseur) && typeof n.attrs?.id === "string" ? (
        <LecteurVideo video={{ fournisseur: n.attrs.fournisseur, id: n.attrs.id }} titre="vidéo intégrée" />
      ) : null;
    case "horizontalRule":
      return <hr className="my-2 h-px border-0 bg-separateur" />;
    default:
      return null;
  }
}

/** Le contenu riche d'une leçon ou d'une consigne ; `images` : le lien signé de chaque image. */
export function DocumentLecon({ document, images, className }: { document: Doc; images: Record<string, string>; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-3 text-[15px] leading-6 text-pretty wrap-anywhere text-texte max-sm:text-sm max-sm:leading-[22px]", className)}>
      {document.content.map((n, i) => (
        <Bloc key={i} n={n} images={images} />
      ))}
    </div>
  );
}
