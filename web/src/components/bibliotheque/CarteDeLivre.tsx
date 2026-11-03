import { useId, type ReactNode } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { CardShell } from "@/components/ui/CourseCard";
import { Couverture } from "@/components/ui/Couverture";
import { MetaDot, ProgressBar } from "@/components/ui/Progress";
import { adresseLivre, LIBELLES_ACCES, pages, progressionLivre, TON_ACCES } from "@/lib/bibliotheque/regles";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import { cn } from "@/lib/cn";
import { urlCouverture } from "@/lib/couvertures/adresse";

// Les cartes des livres pour les étudiants et les visiteurs (spec du 3 novembre 2026, §2) : au style des cartes du
// catalogue (CardShell, CatalogCard), la couverture du livre montrée entière.

/** La couleur du livre : celle de son premier parcours, sinon celle de la réussite académique. */
const couleurDe = (livre: CarteLivre) => livre.parcours[0]?.couleur ?? "academique";

/**
 * La carte d'un livre (catalogue, favoris, recherche) : couverture et accès (« Gratuit », « Inclus dans l'abonnement »),
 * titre, auteur, résumé, pages et catégorie ; en bas, la progression d'un livre commencé (« 42 % lus », « Terminé ») ou
 * « Voir le livre », et le cœur d'un compte connecté, posé hors du lien de la carte.
 */
export function CarteDeLivre({
  livre,
  titleAs = "h2",
  coeur,
  sansEtiquette = false,
}: {
  livre: CarteLivre;
  titleAs?: "h2" | "h3";
  /** Le cœur favori (compte connecté) ; absent : pas de cœur. */
  coeur?: ReactNode;
  /** Sans l'étiquette d'accès : un bouton occupe le coin (cœur de la page Favoris). */
  sansEtiquette?: boolean;
}) {
  const id = useId();
  const meta = [livre.nbPages ? pages(livre.nbPages) : null, livre.categorie?.nom ?? null].filter((m): m is string => Boolean(m));
  const action = progressionLivre(livre.lecture) ?? "Voir le livre";
  return (
    <CardShell
      href={adresseLivre(livre.slug)}
      title={livre.titre}
      description={livre.resume}
      parcours={couleurDe(livre)}
      couverture={urlCouverture(livre.couverture)}
      formatCouverture="livre"
      tag={sansEtiquette ? undefined : { tone: TON_ACCES[livre.acces], label: LIBELLES_ACCES[livre.acces] }}
      titleAs={titleAs}
      describedBy={[meta.length > 0 && `${id}-meta`, `${id}-action`].filter(Boolean).join(" ")}
      sousTitre={
        livre.auteur ? (
          <p title={livre.auteur} className="m-0 mt-1 truncate text-[13px] leading-5 text-texte max-sm:text-xs">
            {livre.auteur}
          </p>
        ) : undefined
      }
      horsLien={
        // Aligné sur le bouton du bas, comme le cœur des cartes du catalogue.
        coeur ? <div className="absolute right-5 bottom-[18px] flex">{coeur}</div> : undefined
      }
    >
      {meta.length > 0 && (
        <div id={`${id}-meta`} className="mt-3 flex min-w-0 flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret max-sm:text-[11.5px]">
          {meta.flatMap((m, i) => (i === 0 ? [<span key={m}>{m}</span>] : [<MetaDot key={`point-${m}`} />, <span key={m} className="min-w-0 truncate">{m}</span>]))}
        </div>
      )}
      <div className="mt-auto flex gap-2 pt-4 max-sm:pt-3.5">
        {/* L'aspect d'un bouton doux : la carte entière est le lien. */}
        <span
          id={`${id}-action`}
          className={cn(
            buttonVariants({ variant: "doux" }),
            "h-auto min-h-10 min-w-0 flex-1 px-2.5 py-1.5 text-center text-[13px] leading-[18px] whitespace-normal group-hover:bg-bleu-pale",
            "max-sm:min-h-9 max-sm:text-[12.5px] max-sm:leading-4",
          )}
        >
          {action}
        </span>
        {/* La place du cœur, posé par-dessus hors du lien. */}
        {coeur && <span aria-hidden="true" className="w-10 flex-none max-sm:w-9" />}
      </div>
    </CardShell>
  );
}

/**
 * Une petite carte (« Continuer la lecture », « Pour aller plus loin ») : couverture, titre sur deux lignes, auteur et,
 * pour un livre commencé, sa progression. `href` : où elle mène (le lecteur pour reprendre, sinon la fiche).
 */
export function CarteLivreCompacte({ livre, href, titleAs = "h3" }: { livre: CarteLivre; href?: string; titleAs?: "h3" | "h4" }) {
  const id = useId();
  const Titre = titleAs;
  const progression = progressionLivre(livre.lecture);
  return (
    <Link
      href={href ?? adresseLivre(livre.slug)}
      aria-labelledby={`${id}-titre`}
      aria-describedby={`${id}-detail`}
      className="focus-etudium box-border flex h-full min-w-0 flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau text-inherit no-underline transition-colors hover:border-bordure-champ"
    >
      <Couverture src={urlCouverture(livre.couverture)} parcours={couleurDe(livre)} sizes="(max-width: 640px) 150px, 220px" format="livre" />
      <div className="flex min-w-0 flex-1 flex-col px-3 pt-2.5 pb-3">
        <Titre id={`${id}-titre`} title={livre.titre} className="m-0 line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-encre">
          {livre.titre}
        </Titre>
        <span id={`${id}-detail`} className="mt-1 flex min-w-0 flex-col gap-1.5">
          {livre.auteur && <span className="truncate text-xs leading-[18px] text-discret">{livre.auteur}</span>}
          {livre.lecture && progression && (
            <>
              <ProgressBar value={livre.lecture.terminee ? 100 : livre.lecture.pourcentage} label={`Lecture de ${livre.titre}`} className="mt-1 h-1.5" />
              <span className="text-xs leading-[18px] text-discret">{progression}</span>
            </>
          )}
        </span>
      </div>
    </Link>
  );
}
