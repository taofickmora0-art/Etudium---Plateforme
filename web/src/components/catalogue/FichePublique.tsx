import Link from "next/link";
import { SectionAvis } from "@/components/avis/SectionAvis";
import { PourAllerPlusLoin } from "@/components/bibliotheque/PourAllerPlusLoin";
import { Button } from "@/components/ui/Button";
import type { AvisFormation } from "@/lib/avis/types";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import type { Monetisation } from "@/lib/catalogue/monetisation";
import { leconsApercu } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { ApercuFormateur } from "@/lib/formateurs/types";
import { BandeAppelAction } from "./BlocsFiche";
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
  TITRE_CARTE,
  TitreFiche,
  TitreSection,
} from "./StructureFiche";

/**
 * La carte d'accès du visiteur : ce que la formation lui demande (un compte gratuit, ou un abonnement) et l'aperçu
 * gratuit. Le bouton pour créer son compte est en haut de la fiche (« S’inscrire à ce cours »).
 */
function CarteOffre({ fiche }: { fiche: FicheFormation }) {
  const parcours = [...fiche.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  const apercus = leconsApercu(fiche);
  const texte = "m-0 mt-1 text-sm leading-[22px] text-pretty text-discret max-sm:text-[13px] max-sm:leading-5";
  return (
    <section aria-labelledby="offre-titre" className={CARTE_FICHE}>
      {fiche.gratuite ? (
        <>
          <h2 id="offre-titre" className={TITRE_CARTE}>
            Formation gratuite
          </h2>
          <p className={texte}>Toutes les leçons s’ouvrent avec un compte gratuit.</p>
        </>
      ) : (
        <>
          {/* Chaque abonnement ouvre toutes les formations (restructuration, §5.2) ; le parcours guide. */}
          <h2 id="offre-titre" className={TITRE_CARTE}>
            Incluse dans tous les abonnements
          </h2>
          <p className={texte}>Basique, Standard ou Premium : 3 mois, 6 mois ou 1 an.</p>
        </>
      )}
      {apercus[0] && (
        <>
          <p className="m-0 mt-3.5 border-t border-bordure-carte pt-3.5 text-sm leading-[22px] text-texte max-sm:text-[13px] max-sm:leading-5">
            {apercus.length > 1 ? `${apercus.length} leçons sont ouvertes en aperçu.` : "Une leçon est ouverte en aperçu."}
          </p>
          <Button asChild variant="contour" className="mt-3 w-full">
            <Link href={adresseLecon(fiche.slug, apercus[0].id)}>Voir l’aperçu gratuit</Link>
          </Button>
        </>
      )}
      {parcours && <p className="m-0 mt-3.5 text-center text-xs leading-[18px] text-pretty text-discret">Fait partie du parcours {parcours.nom}.</p>}
    </section>
  );
}

/**
 * Fiche formation pour un visiteur (spec du 2 novembre 2026, §5) : la même structure que pour un compte connecté, sans
 * favori ni « Message ». « S’inscrire à ce cours » mène à la création du compte, puis revient à la fiche. En bas, la bande
 * d'appel à l'action des pages publiques.
 */
export function FichePublique({
  fiche,
  avis = null,
  monetisation = null,
  formateur = null,
  livres = [],
}: {
  fiche: FicheFormation;
  /** Null sans la migration 0010. */
  avis?: AvisFormation | null;
  /** Le lien compétence → monétisation (0048) : « À suivre d'abord », « Et ensuite ? Vendre cette compétence ». */
  monetisation?: Monetisation | null;
  /** Le formateur du cours (0070) ; null sans la migration : le bloc d'avant, d'après la fiche. */
  formateur?: ApercuFormateur | null;
  /** « Pour aller plus loin » : les livres de la Bibliothèque recommandés par la formation (0074) ; [] sans eux. */
  livres?: CarteLivre[];
}) {
  // Après la création du compte, retour à la fiche (le champ « next » de l'inscription) ; rien de personnel dans l'adresse.
  const inscription = `/inscription?next=${encodeURIComponent(`/formations/${fiche.slug}`)}`;
  return (
    <>
      <section className="box-border rounded-panneau bg-panneau p-[clamp(20px,4vw,40px)] max-sm:p-4">
        <MiseEnPageFiche
          entete={
            <EnTeteFiche
              fiche={fiche}
              action={
                <Button asChild size="lg" className={BOUTON_FICHE}>
                  <Link href={inscription}>S’inscrire à ce cours</Link>
                </Button>
              }
            />
          }
          titre={<TitreFiche fiche={fiche} note={fiche.note} nbAvis={fiche.nbAvis} />}
          cote={
            <>
              <FormateurDuCours fiche={fiche} formateur={formateur} />
              <CarteOffre fiche={fiche} />
              <CarteInclus fiche={fiche} />
            </>
          }
        >
          <section aria-labelledby="contenus-titre" className="flex min-w-0 flex-col gap-4">
            <TitreSection id="contenus-titre">Contenus du cours</TitreSection>
            <ProgrammeFiche fiche={fiche} />
          </section>
          <ApprentissagesFiche fiche={fiche} />
          <BlocMonetisation monetisation={monetisation} />
          <PourAllerPlusLoin livres={livres} />
          <section aria-labelledby="avis-titre" className="flex min-w-0 flex-col gap-4">
            <TitreSection id="avis-titre">Avis des étudiants</TitreSection>
            <SectionAvis variante="public" formation={{ id: fiche.id, titre: fiche.titre }} donnees={avis} peutNoter={false} />
          </section>
        </MiseEnPageFiche>
      </section>
      <BandeAppelAction />
    </>
  );
}
