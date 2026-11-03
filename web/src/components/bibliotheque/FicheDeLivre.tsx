import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight01Icon, ArrowRight02Icon, BookOpen01Icon } from "@hugeicons/core-free-icons";
import { CARTE_FICHE, TitreSection } from "@/components/catalogue/StructureFiche";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Couverture } from "@/components/ui/Couverture";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import { tailleLisible } from "@/lib/admin/fichiers";
import { adresseLivre, boutonLecture, LIBELLES_ACCES, nomLangue, pages, progressionLivre, TON_ACCES } from "@/lib/bibliotheque/regles";
import type { FicheLivre } from "@/lib/bibliotheque/types";
import { urlCouverture } from "@/lib/couvertures/adresse";
import { BoutonTelechargerLivre } from "./BoutonTelechargerLivre";
import { BoutonFavoriLivre } from "./CoeurLivre";

// La fiche d'un livre (spec du 3 novembre 2026, §2), au style de la fiche d'une formation : le fil, puis la couverture et
// ce que dit le livre ; à droite, la carte de lecture (le bouton selon l'accès, « Télécharger », le cœur) ; dessous, les
// informations et les formations qui le recommandent.

const TEXTE = "m-0 mt-2 text-sm leading-[22px] text-pretty text-texte max-sm:text-[13px] max-sm:leading-5";

/** Le bouton principal selon l'accès (acces_etat) : lire, se connecter, voir les abonnements ; fermé, une phrase. */
function CarteLecture({ fiche, connecte }: { fiche: FicheLivre; connecte: boolean }) {
  const retour = encodeURIComponent(adresseLivre(fiche.slug));
  let contenu: ReactNode;
  if (fiche.accesEtat === "ouvert") {
    const bouton = boutonLecture(fiche);
    const progression = progressionLivre(fiche.lecture);
    contenu = (
      <>
        {fiche.lecture && progression ? (
          <>
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm leading-[22px] font-medium text-discret">Votre lecture</span>
              <span className="flex-none text-sm leading-[22px] font-medium text-encre">{progression}</span>
            </div>
            <ProgressBar value={fiche.lecture.terminee ? 100 : fiche.lecture.pourcentage} label={`Lecture de ${fiche.titre}`} className="mt-2.5" />
          </>
        ) : (
          <span className="text-sm leading-[22px] font-medium text-discret">{fiche.acces === "gratuit" ? "Livre gratuit" : "Inclus dans votre abonnement"}</span>
        )}
        <Button asChild size="lg" className="mt-4 w-full max-sm:h-11 max-sm:text-[15px]">
          <Link href={bouton.href}>
            <Icon icon={BookOpen01Icon} size={20} />
            <span>{bouton.libelle}</span>
          </Link>
        </Button>
      </>
    );
  } else if (fiche.accesEtat === "connexion") {
    contenu = (
      <>
        <span className="text-sm leading-[22px] font-medium text-discret">{fiche.acces === "gratuit" ? "Livre gratuit" : "Inclus dans tous les abonnements"}</span>
        <p className={TEXTE}>{fiche.acces === "gratuit" ? "Il se lit avec un compte Étudium gratuit." : "Connectez-vous pour le lire dans le site."}</p>
        <Button asChild size="lg" className="mt-4 w-full max-sm:h-11 max-sm:text-[15px]">
          <Link href={`/connexion?next=${retour}`}>Se connecter pour lire</Link>
        </Button>
        <p className="m-0 mt-3 text-center text-[13px] leading-5 text-discret">
          Pas encore de compte ?{" "}
          <Link href={`/inscription?next=${retour}`} className="focus-etudium font-medium text-bleu no-underline hover:underline">
            Créer un compte
          </Link>
        </p>
      </>
    );
  } else if (fiche.accesEtat === "abonnement") {
    contenu = (
      <>
        <span className="text-sm leading-[22px] font-medium text-discret">Inclus dans tous les abonnements</span>
        <p className={TEXTE}>Un abonnement ouvre toute la bibliothèque.</p>
        <Button asChild size="lg" className="mt-4 w-full max-sm:h-11 max-sm:text-[15px]">
          <Link href="/abonnement/souscrire">
            <span>Voir les abonnements</span>
            <Icon icon={ArrowRight02Icon} size={20} />
          </Link>
        </Button>
      </>
    );
  } else {
    contenu = <p className="m-0 text-sm leading-[22px] text-pretty text-texte max-sm:text-[13px] max-sm:leading-5">Ce livre n’est pas accessible pour le moment.</p>;
  }
  return (
    <div className={CARTE_FICHE}>
      <div data-testid="action-livre" className="flex min-w-0 flex-col">
        {contenu}
      </div>
      {fiche.accesEtat === "ouvert" &&
        (fiche.telechargeable ? (
          <BoutonTelechargerLivre livreId={fiche.id} titre={fiche.titre} className="mt-3" />
        ) : (
          <p className="m-0 mt-3 text-center text-[13px] leading-5 text-discret">Lecture dans le site, sans téléchargement.</p>
        ))}
      {/* Un compte connecté met le livre de côté, même fermé ; un visiteur n'a pas de favoris. */}
      {connecte && <BoutonFavoriLivre livreId={fiche.id} favoriInitial={fiche.favori} className="mt-3" />}
    </div>
  );
}

/** « À propos du livre » : catégorie, parcours, langue, année, pages et taille ; une information inconnue est omise. */
function Informations({ fiche }: { fiche: FicheLivre }) {
  const id = useId();
  const lignes: [string, string][] = [
    ["Catégorie", fiche.categorie?.nom ?? ""],
    ["Parcours", fiche.parcours.map((p) => p.nom).join(", ")],
    ["Langue", nomLangue(fiche.langue)],
    ["Année", fiche.annee ? String(fiche.annee) : ""],
    ["Pages", fiche.nbPages ? pages(fiche.nbPages) : ""],
    ["Taille", fiche.tailleOctets ? tailleLisible(fiche.tailleOctets) : ""],
  ];
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <TitreSection id={id}>À propos du livre</TitreSection>
      <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(min(100%,180px),1fr))] gap-x-6 gap-y-4 rounded-carte border border-bordure-carte bg-panneau p-5 max-sm:gap-y-3 max-sm:p-4">
        {lignes
          .filter(([, valeur]) => valeur)
          .map(([terme, valeur]) => (
            <div key={terme} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-xs leading-[18px] text-discret">{terme}</dt>
              <dd className="m-0 text-sm leading-[22px] font-medium text-encre wrap-anywhere max-sm:text-[13px] max-sm:leading-5">{valeur}</dd>
            </div>
          ))}
      </dl>
    </section>
  );
}

/** Les formations publiées qui recommandent ce livre (« Pour aller plus loin » de leur fiche), vers leur fiche. */
function FormationsLiees({ fiche }: { fiche: FicheLivre }) {
  const id = useId();
  if (fiche.formations.length === 0) return null;
  const couleur = fiche.parcours[0]?.couleur ?? "academique";
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <TitreSection id={id}>Formations liées</TitreSection>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 p-0">
        {fiche.formations.map((f) => (
          <li key={f.id} className="min-w-0">
            <Link
              href={`/formations/${f.slug}`}
              className="focus-etudium flex min-w-0 items-center gap-3 rounded-carte border border-bordure-carte bg-panneau p-2.5 pr-3.5 text-inherit no-underline transition-colors hover:border-bordure-champ"
            >
              <Couverture src={urlCouverture(f.couverture)} parcours={couleur} sizes="96px" className="w-24 flex-none rounded-[10px]" />
              <span className="min-w-0 flex-1 text-sm leading-5 font-semibold text-encre line-clamp-2">{f.titre}</span>
              <Icon icon={ArrowRight01Icon} size={18} className="flex-none text-discret" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * La fiche d'un livre, pour un visiteur (« public », dans le cadre public) ou un compte connecté. Un brouillon ne s'ouvre
 * que pour l'équipe des contenus (livre_fiche) : elle le voit avec un bandeau d'aperçu.
 */
export function FicheDeLivre({ fiche, variante }: { fiche: FicheLivre; variante: "public" | "connecte" }) {
  const connecte = variante === "connecte";
  const couleur = fiche.parcours[0]?.couleur ?? "academique";
  const contenu = (
    <div className="flex min-w-0 flex-col gap-6 max-sm:gap-5">
      <nav aria-label="Fil d’Ariane" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm leading-5 max-sm:text-[13px]">
        <Link href="/bibliotheque" className="focus-etudium text-discret no-underline hover:text-texte">
          Bibliothèque
        </Link>
        <span className="flex text-discret">
          <Icon icon={ArrowRight01Icon} size={14} />
        </span>
        <span aria-current="page" className="min-w-0 font-medium text-encre">
          {fiche.titre}
        </span>
      </nav>
      {fiche.statut !== "publie" && <Banner tone="attention" title="Aperçu : ce livre n’est pas publié. Les étudiants ne le voient pas encore." />}
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(280px,340px)] items-start gap-8 max-lg:grid-cols-1 max-sm:gap-5">
        <div className="flex min-w-0 flex-col gap-8 max-sm:gap-6">
          <div className="flex min-w-0 items-start gap-6 max-sm:flex-col max-sm:items-center max-sm:gap-4">
            <Couverture
              src={urlCouverture(fiche.couverture)}
              parcours={couleur}
              sizes="(max-width: 640px) 180px, 220px"
              format="livre"
              prioritaire
              className="aspect-[3/4] w-[220px] flex-none rounded-carte max-sm:w-[180px]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 max-sm:w-full">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={TON_ACCES[fiche.acces]}>{LIBELLES_ACCES[fiche.acces]}</Tag>
                {fiche.parcours.map((p) => (
                  <Tag key={p.id} tone={p.couleur as TagTone}>
                    {p.nomCourt}
                  </Tag>
                ))}
              </div>
              <Heading level="page">{fiche.titre}</Heading>
              {fiche.auteur && <p className="m-0 text-[15px] leading-[22px] font-medium text-texte max-sm:text-sm max-sm:leading-5">{fiche.auteur}</p>}
              {fiche.resume && <Lead className="whitespace-pre-line text-discret">{fiche.resume}</Lead>}
            </div>
          </div>
          <Informations fiche={fiche} />
          <FormationsLiees fiche={fiche} />
        </div>
        <aside aria-label="Lire ce livre" className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[calc(var(--entete-app,0px)+16px)]">
          <CarteLecture fiche={fiche} connecte={connecte} />
        </aside>
      </div>
    </div>
  );
  if (connecte) return contenu;
  return <section className="box-border rounded-panneau bg-panneau p-[clamp(20px,4vw,40px)] max-sm:p-4">{contenu}</section>;
}
