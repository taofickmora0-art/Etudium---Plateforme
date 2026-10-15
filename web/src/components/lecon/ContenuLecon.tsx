import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { situation } from "@/lib/lecon/regles";
import type { DonneesLecon } from "@/lib/lecon/types";
import { DansCetteLecon } from "./DansCetteLecon";
import { EnTeteLecon } from "./EnTeteLecon";
import { LeconVerrouillee } from "./LeconVerrouillee";
import { TexteMisEnForme } from "@/components/communaute/TexteMisEnForme";
import type { MoiCommunaute } from "@/lib/communaute/types";
import { BandeauApercu, type Apercu } from "./BandeauApercu";
import { DiscussionsLecon } from "./DiscussionsLecon";
import { LecteurEtudium } from "./LecteurEtudium";
import { NavigationLecon } from "./NavigationLecon";
import { NoteProvider, NotesLecon } from "./NotesLecon";
import { OngletsLecon } from "./OngletsLecon";
import { ProgrammeMobile } from "./ProgrammeMobile";
import { RessourcesLecon } from "./RessourcesLecon";
import { VisiteLecon } from "./VisiteLecon";

type Props = {
  donnees: DonneesLecon;
  connecte: boolean;
  terminees: ReadonlySet<string>;
  /** L'équipe ou le formateur en aperçu (formation non publiée, leçon en brouillon) : rien n'est enregistré. */
  apercu?: Apercu | null;
  /** Le compte connecté, pour les discussions (0028). */
  moi?: MoiCommunaute | null;
};

/**
 * Le contenu de la page leçon (NdLecon, NdMobLecon) : vidéo, en-tête, navigation, onglets et « Dans cette leçon ».
 * Une leçon fermée n'affiche que son verrou, son en-tête et son résumé : jamais la vidéo, le texte ni les fichiers.
 */
export function ContenuLecon({ donnees, connecte, terminees, apercu = null, moi = null }: Props) {
  const { fiche, lecon, note, notesDisponibles } = donnees;
  const ouverte = lecon.accessible;
  const ou = situation(fiche.modules, lecon.id);
  const programme = <ProgrammeMobile fiche={fiche} leconId={lecon.id} connecte={connecte} terminees={terminees} />;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {apercu && <BandeauApercu apercu={apercu} />}
      {ouverte && connecte && !apercu && <VisiteLecon leconId={lecon.id} />}
      {ouverte && !connecte && (
        // Spec Q1 : le visiteur regarde l'aperçu ; on l'invite à créer son compte pour garder sa progression.
        <Banner
          tone="information"
          title="Vous regardez un aperçu gratuit"
          action={
            <Button asChild size="sm">
              <Link href="/inscription">Créer un compte gratuit</Link>
            </Button>
          }
        >
          Créez votre compte gratuit pour enregistrer votre progression.
        </Banner>
      )}
      {!ouverte ? (
        <LeconVerrouillee fiche={fiche} leconId={lecon.id} connecte={connecte} />
      ) : (
        lecon.video && (
          <LecteurEtudium
            video={lecon.video}
            titre={lecon.titre}
            legende={ou ? `Module ${ou.numero} · ${lecon.titre}` : lecon.titre}
            leconId={lecon.id}
            // Sans la table du visionnage (0007 pas encore appliquée), la vidéo se lit sans mesure.
            suivre={connecte && !apercu && lecon.visionnage !== null}
            passagesInitiaux={lecon.visionnage?.passages ?? []}
            reference={lecon.dureeSecondes}
            seuil={fiche.seuilVideo}
            termineeInitiale={lecon.visionnage?.terminee ?? false}
            positionInitiale={lecon.visionnage?.positionSecondes ?? 0}
          />
        )
      )}
      <EnTeteLecon fiche={fiche} lecon={lecon} />
      {/* Le texte mis en forme dans l'éditeur de leçon (titres, gras, listes, liens), comme les publications. */}
      {ouverte && lecon.texte && <TexteMisEnForme texte={lecon.texte} className="text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]" />}
      <NavigationLecon fiche={fiche} leconId={lecon.id} />
      <div aria-hidden="true" className="h-px bg-separateur max-lg:hidden" />
      <div className="flex flex-wrap items-start gap-8">
        {ouverte ? (
          <div className="flex min-w-0 flex-[999_1_420px] flex-col">
            <NoteProvider key={lecon.id} noteInitiale={note}>
              <OngletsLecon
                programme={programme}
                ressources={<RessourcesLecon ressources={lecon.ressources} />}
                notes={<NotesLecon leconId={lecon.id} noteInitiale={note} connecte={connecte} disponible={notesDisponibles} />}
              />
            </NoteProvider>
          </div>
        ) : (
          // Sans onglets, le téléphone garde quand même le programme (il n'a pas de panneau à gauche).
          <section aria-labelledby="programme-lecon" className="flex min-w-0 flex-[999_1_420px] flex-col gap-2 lg:hidden">
            <h2 id="programme-lecon" className="m-0 text-base leading-6 font-semibold text-encre">
              Programme de la formation
            </h2>
            {programme}
          </section>
        )}
        <div className="min-w-0 flex-[1_1_300px] empty:hidden">
          <DansCetteLecon resume={lecon.resume} pointsCles={lecon.pointsCles} />
        </div>
      </div>
      {/* Les discussions, sous le contenu et visibles sans clic (refonte des formations, §1.6). */}
      {ouverte && donnees.discussion && moi && (
        <DiscussionsLecon key={lecon.id} leconId={lecon.id} slug={fiche.slug} initial={donnees.discussion} moi={moi} maintenant={new Date()} />
      )}
    </div>
  );
}
