import type { ReactNode } from "react";
import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { QuizLecon } from "@/components/quiz/QuizLecon";
import { ExerciceLecon } from "@/components/exercices/ExerciceLecon";
import { videoMesuree, voisines } from "@/lib/lecon/regles";
import type { DonneesLecon } from "@/lib/lecon/types";
import { DansCetteLecon } from "./DansCetteLecon";
import { EnTeteLecon } from "./EnTeteLecon";
import { LeconVerrouillee } from "./LeconVerrouillee";
import { TexteMisEnForme } from "@/components/communaute/TexteMisEnForme";
import type { MoiCommunaute } from "@/lib/communaute/types";
import { BandeauApercu, type Apercu } from "./BandeauApercu";
import { DiscussionsLecon } from "./DiscussionsLecon";
import { LecteurEtudium } from "./LecteurEtudium";
import { LecteurVideo } from "./LecteurVideo";
import { NavigationLecon } from "./NavigationLecon";
import { NoteProvider, NotesLecon } from "./NotesLecon";
import { OngletsLecon } from "./OngletsLecon";
import { RessourcesLecon } from "./RessourcesLecon";
import { VisiteLecon } from "./VisiteLecon";

type Props = {
  donnees: DonneesLecon;
  connecte: boolean;
  /** L'équipe ou le formateur en aperçu (formation non publiée, leçon en brouillon) : rien n'est enregistré. */
  apercu?: Apercu | null;
  /** Le compte connecté, pour les discussions (0028). */
  moi?: MoiCommunaute | null;
  /** « Modifier la leçon », pour l'équipe et le formateur de la formation. */
  lienModifier?: string | null;
};

/**
 * Le contenu de la page leçon (NdLecon, NdMobLecon) : vidéo, en-tête, navigation, onglets et « Dans cette leçon ».
 * Une leçon fermée n'affiche que son verrou, son en-tête et son résumé : jamais la vidéo, le texte ni les fichiers.
 * Un quiz (lot 3) : l'en-tête, puis le quiz ; ni texte, ni onglets, ni « Terminer la leçon ». Un exercice : l'en-tête,
 * la consigne et ses fichiers, puis le travail.
 */
export function ContenuLecon({ donnees, connecte, apercu = null, moi = null, lienModifier = null }: Props) {
  const { fiche, lecon, note, notesDisponibles } = donnees;
  const ouverte = lecon.accessible;
  const quiz = fiche.modules.some((m) => m.lecons.some((l) => l.id === lecon.id && l.type === "quiz"));
  if (quiz) return <ContenuQuiz donnees={donnees} connecte={connecte} apercu={apercu} moi={moi} lienModifier={lienModifier} />;
  const exercice = fiche.modules.some((m) => m.lecons.some((l) => l.id === lecon.id && l.type === "exercice"));
  if (exercice) return <ContenuExercice donnees={donnees} connecte={connecte} apercu={apercu} moi={moi} lienModifier={lienModifier} />;
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
        lecon.video &&
        (!videoMesuree(lecon) ? (
          // Loom, ScreenPal, Google Drive : le lecteur de la plateforme ; la leçon se termine d'un clic.
          <LecteurVideo video={lecon.video} titre={lecon.titre} />
        ) : (
          <LecteurEtudium
            video={lecon.video}
            titre={lecon.titre}
            // Sur la vidéo, le titre de la leçon regardée (le module est déjà au-dessus du titre de la page).
            legende={lecon.titre}
            leconId={lecon.id}
            // Sans la table du visionnage (0007 pas encore appliquée), la vidéo se lit sans mesure.
            suivre={connecte && !apercu && lecon.visionnage !== null}
            passagesInitiaux={lecon.visionnage?.passages ?? []}
            reference={lecon.dureeSecondes}
            seuil={fiche.seuilVideo}
            termineeInitiale={lecon.visionnage?.terminee ?? false}
            positionInitiale={lecon.visionnage?.positionSecondes ?? 0}
          />
        ))
      )}
      <EnTeteLecon fiche={fiche} lecon={lecon} lienModifier={lienModifier} />
      {/* Le texte mis en forme dans l'éditeur de leçon (titres, gras, listes, liens), comme les publications. */}
      {ouverte && lecon.texte && <TexteMisEnForme texte={lecon.texte} className="text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]" />}
      <NavigationLecon fiche={fiche} leconId={lecon.id} />
      <div aria-hidden="true" className="h-px bg-separateur max-lg:hidden" />
      <div className="flex flex-wrap items-start gap-8">
        {ouverte && (
          <div className="flex min-w-0 flex-[999_1_420px] flex-col">
            <NoteProvider key={lecon.id} noteInitiale={note}>
              <OngletsLecon
                ressources={<RessourcesLecon ressources={lecon.ressources} />}
                notes={<NotesLecon leconId={lecon.id} noteInitiale={note} connecte={connecte} disponible={notesDisponibles} />}
              />
            </NoteProvider>
          </div>
        )}
        <div className="min-w-0 flex-[1_1_300px] empty:hidden">
          <DansCetteLecon resume={lecon.resume} pointsCles={lecon.pointsCles} />
        </div>
      </div>
      {/* Les discussions, sous le contenu et visibles sans clic (refonte des formations, §1.6). Pas en aperçu : un
          commentaire de test y serait enregistré, et visible des étudiants à la publication. */}
      {ouverte && !apercu && donnees.discussion && moi && (
        <DiscussionsLecon key={lecon.id} leconId={lecon.id} slug={fiche.slug} initial={donnees.discussion} moi={moi} maintenant={new Date()} />
      )}
    </div>
  );
}

/** La page d'un quiz : l'en-tête, le quiz (ou ce qui empêche de le passer), la navigation et les discussions. */
function ContenuQuiz({ donnees, connecte, apercu = null, moi = null, lienModifier = null }: Props) {
  const { fiche, lecon } = donnees;
  const { precedente, suivante } = voisines(fiche.modules, lecon.id);
  let quiz: ReactNode;
  if (!lecon.accessible) {
    quiz = <LeconVerrouillee fiche={fiche} leconId={lecon.id} connecte={connecte} />;
  } else if (!connecte) {
    quiz = <InviterConnexion fiche={fiche} leconId={lecon.id} titre="Connectez-vous pour passer ce quiz et garder votre score." />;
  } else if (donnees.quiz) {
    quiz = (
      <QuizLecon
        key={lecon.id}
        leconId={lecon.id}
        quiz={donnees.quiz}
        precedente={precedente ? adresseLecon(fiche.slug, precedente.id) : undefined}
        suivante={suivante ? adresseLecon(fiche.slug, suivante.id) : undefined}
      />
    );
  } else {
    quiz = <Banner tone="information" title="Ce quiz n’est pas disponible pour le moment." />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {apercu && <BandeauApercu apercu={apercu} />}
      <EnTeteLecon fiche={fiche} lecon={lecon} lienModifier={lienModifier} type="quiz" />
      {quiz}
      <NavigationLecon fiche={fiche} leconId={lecon.id} />
      {lecon.accessible && !apercu && donnees.discussion && moi && (
        <DiscussionsLecon key={lecon.id} leconId={lecon.id} slug={fiche.slug} initial={donnees.discussion} moi={moi} maintenant={new Date()} />
      )}
    </div>
  );
}

/** Un visiteur devant un quiz ou un exercice d'aperçu : créer un compte, ou se connecter et revenir ici. */
function InviterConnexion({ fiche, leconId, titre }: { fiche: DonneesLecon["fiche"]; leconId: string; titre: string }) {
  return (
    <Banner
      tone="information"
      title={titre}
      action={
        <span className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/inscription">Créer un compte gratuit</Link>
          </Button>
          <Button asChild size="sm" variant="contour">
            <Link href={`/connexion?next=${encodeURIComponent(adresseLecon(fiche.slug, leconId))}`}>Se connecter</Link>
          </Button>
        </span>
      }
    />
  );
}

/** La page d'un exercice : l'en-tête, la consigne et ses fichiers, le travail (ou ce qui empêche de le faire), la suite. */
function ContenuExercice({ donnees, connecte, apercu = null, moi = null, lienModifier = null }: Props) {
  const { fiche, lecon } = donnees;
  let travail: ReactNode;
  if (!lecon.accessible) {
    travail = <LeconVerrouillee fiche={fiche} leconId={lecon.id} connecte={connecte} />;
  } else if (!connecte) {
    travail = <InviterConnexion fiche={fiche} leconId={lecon.id} titre="Connectez-vous pour faire cet exercice." />;
  } else if (donnees.exercice) {
    travail = <ExerciceLecon key={lecon.id} leconId={lecon.id} exercice={donnees.exercice} />;
  } else {
    travail = <Banner tone="information" title="Cet exercice n’est pas disponible pour le moment." />;
  }
  return (
    <div className="flex min-w-0 flex-col gap-6">
      {apercu && <BandeauApercu apercu={apercu} />}
      <EnTeteLecon fiche={fiche} lecon={lecon} lienModifier={lienModifier} type="exercice" />
      {lecon.accessible && (
        <section aria-label="Consigne" className="flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
          <h2 className="m-0 text-lg leading-7 font-semibold text-encre max-sm:text-base">Consigne</h2>
          {lecon.texte ? (
            <TexteMisEnForme texte={lecon.texte} className="text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]" />
          ) : (
            <p className="m-0 text-sm leading-[22px] text-discret">La consigne arrive bientôt.</p>
          )}
          {lecon.ressources.length > 0 && <RessourcesLecon ressources={lecon.ressources} />}
        </section>
      )}
      {travail}
      <NavigationLecon fiche={fiche} leconId={lecon.id} />
      {lecon.accessible && !apercu && donnees.discussion && moi && (
        <DiscussionsLecon key={lecon.id} leconId={lecon.id} slug={fiche.slug} initial={donnees.discussion} moi={moi} maintenant={new Date()} />
      )}
    </div>
  );
}
