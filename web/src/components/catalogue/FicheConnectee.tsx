import Link from "next/link";
import { ArrowRight02Icon, Certificate01Icon, Clock01Icon, MessageMultiple02Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { SectionAvis } from "@/components/avis/SectionAvis";
import { PourAllerPlusLoin } from "@/components/bibliotheque/PourAllerPlusLoin";
import { BoutonFavori } from "@/components/favoris/BoutonFavori";
import { BoutonInscription } from "@/components/inscriptions/BoutonInscription";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MetaDot, ProgressBar } from "@/components/ui/Progress";
import { formatDuree } from "@/lib/admin/duree";
import { peutDonnerAvis } from "@/lib/avis/regles";
import type { AvisFormation } from "@/lib/avis/types";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import type { Monetisation } from "@/lib/catalogue/monetisation";
import { actionFiche, dureeLisible, estLeconDeContenu, etatAcces, leconsApercu, toutOuvert, type ActionFiche } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import type { StatutRendu } from "@/lib/exercices/types";
import type { ApercuFormateur } from "@/lib/formateurs/types";
import type { GroupeDeFormation } from "@/lib/groupes/types";
import type { AccesFormation } from "@/lib/inscriptions/types";
import type { EtatProgression } from "@/lib/progression/regles";
import { BlocMonetisation } from "./BlocMonetisation";
import { adresseLecon, ProgrammeFiche } from "./ProgrammeFiche";
import {
  ApprentissagesFiche,
  BOUTON_FICHE,
  CARTE_FICHE,
  CarteInclus,
  EnTeteFiche,
  FormateurDuCours,
  MiseEnPageFiche,
  TitreFiche,
  TitreSection,
} from "./StructureFiche";

/**
 * « Progression du cours » (NdFormation §6.4 ; refonte des formations, §2) : pourcentage, barre, « Terminé 3 sur 22 » et
 * temps restant.
 */
function EnTeteProgression({ fiche, progression }: { fiche: FicheFormation; progression: EtatProgression }) {
  const restant = dureeLisible(progression.restantSecondes);
  // Les quiz ne comptent pas dans la progression (R17).
  const lecons = fiche.modules.flatMap((m) => m.lecons).filter(estLeconDeContenu);
  const faites = lecons.filter((l) => progression.terminees.has(l.id)).length;
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <span className="text-sm leading-[22px] font-medium text-discret">Progression du cours</span>
        <span className="flex-none text-[28px] leading-8 font-medium tracking-[-0.01em] whitespace-nowrap text-titre max-sm:text-2xl">{progression.pourcentage} %</span>
      </div>
      <ProgressBar value={progression.pourcentage} label="Progression de la formation" className="mt-3" />
      <div className="mt-2 flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret">
        <span>{`Terminé ${faites} sur ${lecons.length}`}</span>
        {restant && (
          <>
            <MetaDot />
            <span className="flex items-center gap-1">
              <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
              <span>{restant} restantes</span>
            </span>
          </>
        )}
      </div>
    </>
  );
}

/** « Prochaine leçon » (son titre, son module, sa durée), ou « Formation terminée ». Le bouton est en haut de la fiche. */
function ProchaineLecon({ fiche, progression }: { fiche: FicheFormation; progression: EtatProgression }) {
  const lecon = progression.aReprendre;
  const rang = lecon ? fiche.modules.findIndex((m) => m.lecons.some((l) => l.id === lecon.id)) : -1;
  return (
    <div className="mt-[18px] flex flex-col gap-0.5 border-t border-bordure-carte pt-4">
      {lecon ? (
        <>
          <span className="text-xs leading-[18px] text-discret">Prochaine leçon</span>
          <span className="text-[15px] leading-[22px] font-medium text-encre max-sm:text-sm max-sm:leading-5">{lecon.titre}</span>
          <span className="text-[13px] leading-5 text-discret">{[`Module ${rang + 1}`, formatDuree(lecon.dureeSecondes)].filter(Boolean).join(" · ")}</span>
        </>
      ) : (
        <span className="text-[15px] leading-[22px] font-medium text-reussite-texte">Formation terminée</span>
      )}
    </div>
  );
}

/**
 * Ce que la carte dit de l'accès, avant la première leçon : d'après l'inscription (0069), sinon d'après les leçons
 * ouvertes. Rien de fermé sans inscription (équipe des contenus, formateur de la formation) : « ouverte », sans phrase
 * d'inscription.
 */
function etatDeLaCarte(fiche: FicheFormation, acces: AccesFormation | null): "inscrite" | "a-inscrire" | "ouverte" | "gratuite" | "incluse" | "apercu" | "verrouillee" {
  if (acces?.ouverte) return acces.inscrit ? "inscrite" : toutOuvert(fiche) ? "ouverte" : "a-inscrire";
  if (acces) return leconsApercu(fiche).length > 0 ? "apercu" : "verrouillee";
  return etatAcces(fiche, true);
}

/**
 * Carte d'accès (colonne de droite) : la progression et la prochaine leçon d'une formation commencée ; sinon ce que le
 * compte peut suivre (inscrit, à inscrire, aperçu, verrouillée). Puis le favori, « Validation et certificat » et le
 * parcours. Le bouton principal n'y est plus : il est en haut de la fiche (spec du 2 novembre 2026, §5).
 */
function CarteAcces({
  fiche,
  progression,
  favori,
  acces,
  groupe,
}: {
  fiche: FicheFormation;
  progression: EtatProgression | null;
  favori: boolean | null;
  acces: AccesFormation | null;
  groupe: GroupeDeFormation | null;
}) {
  const etat = etatDeLaCarte(fiche, acces);
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const apercus = leconsApercu(fiche);
  const suivie = progression?.commencee ? progression : null;
  const reprise = suivie && (suivie.aReprendre || suivie.terminee);
  const texte = "m-0 mt-2 text-sm leading-[22px] text-texte max-sm:text-[13px] max-sm:leading-5";
  const intitule = "text-sm leading-[22px] font-medium text-discret max-sm:text-[13px] max-sm:leading-5";
  const OUVERTE = {
    inscrite: "Vous êtes inscrit·e : toutes les leçons sont ouvertes.",
    "a-inscrire": fiche.gratuite ? "Formation gratuite : inscrivez-vous pour ouvrir toutes les leçons." : "Incluse dans votre abonnement : inscrivez-vous pour ouvrir toutes les leçons.",
    ouverte: "Toutes les leçons vous sont ouvertes.",
    gratuite: "Formation gratuite : toutes les leçons sont ouvertes.",
    incluse: "Incluse dans votre abonnement : toutes les leçons sont ouvertes.",
  } as const;
  return (
    <div className={CARTE_FICHE}>
      {suivie && <EnTeteProgression fiche={fiche} progression={suivie} />}
      {reprise && <ProchaineLecon fiche={fiche} progression={suivie} />}
      {!reprise && etat !== "apercu" && etat !== "verrouillee" && (
        <>
          <span className={intitule}>Votre formation</span>
          <p className={texte}>{OUVERTE[etat]}</p>
        </>
      )}
      {!reprise && etat === "apercu" && (
        <>
          <span className={intitule}>Aperçu gratuit</span>
          <p className={texte}>{apercus.length > 1 ? `${apercus.length} leçons sont ouvertes en aperçu.` : "Une leçon est ouverte en aperçu."}</p>
          <p className={cn(texte, "mt-1")}>Incluse dans tous les abonnements.</p>
          {apercus[0] && (
            <Button asChild variant="contour" className="mt-3.5 w-full">
              <Link href={adresseLecon(fiche.slug, apercus[0].id)}>Voir l’aperçu gratuit</Link>
            </Button>
          )}
        </>
      )}
      {!reprise && etat === "verrouillee" && (
        <>
          <span className="flex items-center gap-2 text-base leading-6 font-semibold text-encre max-sm:text-[15px]">
            <Icon icon={SquareLock02Icon} size={18} />
            Formation verrouillée
          </span>
          <p className={texte}>Incluse dans tous les abonnements.</p>
        </>
      )}
      {/* Favoris (tâche 1.9) : absent tant que la table n'est pas dans la base (null). */}
      {favori !== null && (
        <div className="mt-3.5 flex">
          <BoutonFavori formationId={fiche.id} favoriInitial={favori} />
        </div>
      )}
      {/* Ce qui reste pour le certificat (lot 3, étape C). */}
      {suivie && (
        <Link
          href={`/formations/${fiche.slug}/validation`}
          className="focus-etudium mt-3 flex items-center justify-center gap-2 rounded-champ text-sm leading-[22px] font-medium text-bleu no-underline hover:underline"
        >
          <Icon icon={Certificate01Icon} size={18} />
          <span>Validation et certificat</span>
        </Link>
      )}
      {/* Le groupe de discussion de la formation (0075), s'il est actif : le rejoindre, ou s'inscrire pour le rejoindre. */}
      {groupe?.actif &&
        (groupe.ouvert && groupe.slug ? (
          <Button asChild variant="contour" className="mt-3.5 w-full">
            <Link href={`/groupes/${groupe.slug}`}>
              <Icon icon={MessageMultiple02Icon} size={18} />
              <span>Rejoindre le groupe de discussion</span>
            </Link>
          </Button>
        ) : (
          <p className="m-0 mt-3.5 text-center text-[13px] leading-5 text-pretty text-discret">Inscrivez-vous pour rejoindre le groupe de discussion.</p>
        ))}
      {/* Le parcours guide, il n'ouvre plus l'accès (restructuration, §5.2). */}
      {parcours && <p className="m-0 mt-3.5 text-center text-xs leading-[18px] text-pretty text-discret">Fait partie du parcours {parcours.nom}.</p>}
    </div>
  );
}

/** Le bouton du haut de la fiche, un seul (spec du 2 novembre 2026, §5) : s'inscrire, suivre le cours ou voir les abonnements. */
function BoutonDuHaut({ fiche, action }: { fiche: FicheFormation; action: ActionFiche }) {
  if (action.type === "inscrire") {
    return <BoutonInscription formationId={fiche.id} apres={action.apres ? adresseLecon(fiche.slug, action.apres.id) : null} className={BOUTON_FICHE} />;
  }
  return (
    <Button asChild size="lg" className={BOUTON_FICHE}>
      {action.type === "abonnements" ? (
        <Link href="/abonnement/souscrire">Voir les abonnements</Link>
      ) : (
        <Link href={adresseLecon(fiche.slug, action.lecon.id)}>
          <span>{action.libelle}</span>
          <Icon icon={ArrowRight02Icon} size={20} />
        </Link>
      )}
    </Button>
  );
}

/**
 * Fiche formation pour un compte connecté (spec du 2 novembre 2026, §5) : le fil et un seul bouton (« S’inscrire à ce
 * cours », « Commencer le cours », « Poursuivre le cours » ou « Voir les abonnements ») ; le titre, « Contenus du cours »
 * avec leurs cadenas, ce que l'on apprend, la monétisation et les avis ; à droite, le formateur du cours, la carte
 * d'accès (progression, favori, certificat) et « Inclus dans la formation ». Pour l'équipe et le formateur de la
 * formation : « Modifier les leçons » (refonte des formations, §2).
 */
export function FicheConnectee({
  fiche,
  progression = null,
  favori = null,
  avis = null,
  lienModifier = null,
  scores = {},
  statuts = {},
  monetisation = null,
  acces = null,
  formateur = null,
  groupe = null,
  livres = [],
}: {
  fiche: FicheFormation;
  /** Le lien compétence → monétisation (0048) : « À suivre d'abord », « Et ensuite ? Vendre cette compétence ». */
  monetisation?: Monetisation | null;
  progression?: EtatProgression | null;
  /** Formation dans les favoris du compte ; null sans la table des favoris (migration 0009). */
  favori?: boolean | null;
  /** Avis de la formation ; null sans la migration 0010. */
  avis?: AvisFormation | null;
  /** L'onglet « Leçons » de l'éditeur, pour l'équipe et le formateur de la formation. */
  lienModifier?: string | null;
  /** Le meilleur score du compte à chaque quiz (lot 3). */
  scores?: Readonly<Record<string, number>>;
  /** Le dernier statut du compte à chaque exercice (lot 3). */
  statuts?: Readonly<Record<string, StatutRendu>>;
  /** L'inscription du compte et l'ouverture de la formation (0069) ; null sans la migration (ou en aperçu) : les boutons d'avant. */
  acces?: AccesFormation | null;
  /** Le formateur du cours (0070) ; null sans la migration : le bloc d'avant, d'après la fiche. */
  formateur?: ApercuFormateur | null;
  /** Le groupe de discussion de la formation (0075) ; null sans la migration ou sans groupe. */
  groupe?: GroupeDeFormation | null;
  /** « Pour aller plus loin » : les livres de la Bibliothèque recommandés par la formation (0074) ; [] sans eux. */
  livres?: CarteLivre[];
}) {
  // La note vient des avis lus pour ce compte quand ils sont là : son avis masqué y compte pour lui seul, il ne doit
  // pas le voir disparaître de la note (spec des notifications, §5). Sinon, la note de la formation.
  const note = avis ? avis.resume.moyenne : fiche.note;
  const nbAvis = avis ? avis.resume.total : fiche.nbAvis;
  const action = actionFiche(fiche, progression, acces);

  return (
    <MiseEnPageFiche
      entete={<EnTeteFiche fiche={fiche} action={action && <BoutonDuHaut fiche={fiche} action={action} />} />}
      titre={<TitreFiche fiche={fiche} note={note} nbAvis={nbAvis} />}
      cote={
        <>
          <FormateurDuCours fiche={fiche} formateur={formateur} />
          <CarteAcces fiche={fiche} progression={progression} favori={favori} acces={acces} groupe={groupe} />
          <CarteInclus fiche={fiche} />
        </>
      }
    >
      <section aria-labelledby="contenus-titre" className="flex min-w-0 flex-col gap-4">
        <TitreSection id="contenus-titre">Contenus du cours</TitreSection>
        <ProgrammeFiche fiche={fiche} progression={progression?.commencee ? progression : null} lienModifier={lienModifier} scores={scores} statuts={statuts} />
      </section>
      <ApprentissagesFiche fiche={fiche} />
      <BlocMonetisation monetisation={monetisation} />
      <PourAllerPlusLoin livres={livres} />
      <SectionAvis variante="connecte" formation={{ id: fiche.id, titre: fiche.titre }} donnees={avis} peutNoter={progression ? peutDonnerAvis(progression) : false} />
    </MiseEnPageFiche>
  );
}
