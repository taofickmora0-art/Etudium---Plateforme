import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { moiCommunaute } from "@/components/communaute/ContenuCommunaute";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { BarreHautLecon } from "@/components/lecon/BarreHautLecon";
import { CadreLecon } from "@/components/lecon/CadreLecon";
import { EtatLeconProvider } from "@/components/lecon/EtatLecon";
import { ContenuLecon } from "@/components/lecon/ContenuLecon";
import { BarreLecon } from "@/components/lecon/NavigationLecon";
import { ProgrammeLecon, ProgressionCours } from "@/components/lecon/ProgrammeLecon";
import { ProgrammeMobile } from "@/components/lecon/ProgrammeMobile";
import { TiroirLecons } from "@/components/lecon/TiroirLecons";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Apercu } from "@/components/lecon/BandeauApercu";
import { ficheApercu, lienModifierLecon } from "@/lib/catalogue/apercu";
import { getFiche } from "@/lib/catalogue/data";
import type { FicheFormation } from "@/lib/catalogue/types";
import { apercuFormateur } from "@/lib/catalogue/garde-formateur";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { lireAccesFormation } from "@/lib/inscriptions/data";
import { getLeconDans } from "@/lib/lecon/data";
import { formationPartielle, videoMesuree, voisines } from "@/lib/lecon/regles";
import { lireProgression } from "@/lib/progression/data";
import { etatFormation } from "@/lib/progression/regles";
import { lireMesScores } from "@/lib/quiz/data";
import { lireStatutsExercices } from "@/lib/exercices/data";
import type { DonneesLecon } from "@/lib/lecon/types";

type Params = { params: Promise<{ slug: string; leconId: string }> };

/** « Découvrir l’interface · Maîtriser Microsoft Excel · Étudium ». La fiche est la page à référencer, pas la leçon. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, leconId } = await params;
  let titre = "Leçon introuvable · Étudium";
  try {
    // Une formation non publiée : son titre pour l'équipe et son formateur (aperçu).
    const fiche = (await getFiche(slug)) ?? (await ficheApercu(slug));
    const lecon = fiche?.modules.flatMap((m) => m.lecons).find((l) => l.id === leconId);
    if (fiche && lecon) titre = `${lecon.titre} · ${fiche.titre} · Étudium`;
  } catch {
    // Base injoignable : la page elle-même affichera l'erreur.
  }
  return { title: titre, robots: { index: false } };
}

async function Lecon({ params }: Params) {
  const [compte, { slug, leconId }] = await Promise.all([compteConnecte(), params]);
  const connecte = compte !== null;
  let fiche: FicheFormation | null;
  let apercuFormation = false;
  let donnees: DonneesLecon | null;
  let lignes: Awaited<ReturnType<typeof lireProgression>>;
  let moi: Awaited<ReturnType<typeof moiCommunaute>> | null = null;
  let lienModifier: string | null = null;
  let scores: Record<string, number> = {};
  let statuts: Awaited<ReturnType<typeof lireStatutsExercices>> = {};
  try {
    // Une formation non publiée ne s'ouvre qu'en aperçu, pour l'équipe et son formateur (refonte des formations, §3.5).
    fiche = await getFiche(slug);
    if (!fiche && connecte) {
      fiche = await ficheApercu(slug);
      apercuFormation = fiche !== null;
    }
    [donnees, lignes] = fiche ? await Promise.all([getLeconDans(fiche, leconId, connecte), connecte ? lireProgression() : null]) : [null, null];
    const aDes = (type: string) => Boolean(donnees?.fiche.modules.some((m) => m.lecons.some((l) => l.type === type)));
    [moi, lienModifier, scores, statuts] = await Promise.all([
      connecte && donnees?.discussion ? moiCommunaute() : null,
      connecte && donnees ? lienModifierLecon(donnees.fiche.id, leconId) : null,
      // Le meilleur score de chaque quiz, dans le programme (lot 3).
      connecte && donnees && aDes("quiz") ? lireMesScores(donnees.fiche.id) : {},
      // Le dernier statut de chaque exercice, dans le programme (lot 3).
      connecte && donnees && aDes("exercice") ? lireStatutsExercices(donnees.fiche.id) : {},
    ]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Formation non publiée (sauf aperçu), leçon d'une autre formation ou adresse inventée : page introuvable.
  if (!donnees) notFound();

  const { lecon } = donnees;
  // Une leçon en brouillon n'est lue que par l'équipe et le formateur : c'est un aperçu, comme une formation non publiée.
  const enBrouillon = donnees.fiche.modules.some((m) => m.lecons.some((l) => l.id === leconId && l.publiee === false));
  // Un formateur sur une leçon de sa formation la regarde en aperçu ; sur celle d'un autre, il va à son tableau de bord
  // (restructuration R1 : il n'est plus étudiant).
  const formateur = apercuFormateur(compte, lienModifier);
  const apercu: Apercu | null = apercuFormation ? "formation" : enBrouillon ? "lecon" : formateur ? "formateur" : null;
  // En aperçu, le retour mène à l'onglet Programme de l'éditeur de la formation, pour l'équipe comme pour le formateur, et
  // la progression ne s'affiche pas : rien n'y est enregistré (tâche 12 du 31 octobre 2026).
  const retourEdition = apercu && lienModifier ? lienModifier.replace(/\/lecons\/[^/?]+$/, "?onglet=programme") : null;
  // Des leçons fermées alors que la formation est ouverte au compte (0069) : il n'y est pas inscrit. La leçon fermée et le
  // bandeau d'aperçu proposent « S’inscrire à ce cours » ; sans la migration, rien ne change.
  let aInscrire = false;
  if (connecte && !apercu && formationPartielle(donnees.fiche)) {
    try {
      const acces = await lireAccesFormation(donnees.fiche.id);
      aInscrire = acces !== null && acces.ouverte && !acces.inscrit;
    } catch (erreur) {
      return siTablesAbsentes(erreur);
    }
  }
  const progression = connecte && !apercu;
  const terminees = lignes ? etatFormation(donnees.fiche, lignes).terminees : new Set<string>();
  const { precedente, suivante } = voisines(donnees.fiche.modules, leconId);
  // Bouton de fin : compte connecté, leçon ouverte, progression disponible en base (0007, 0008), et pas en aperçu.
  // Un quiz se réussit, un exercice se rend (lot 3) : ni l'un ni l'autre ne se « termine » ; seul « Leçon suivante » reste.
  const activite = donnees.fiche.modules.some((m) => m.lecons.some((l) => l.id === leconId && (l.type === "quiz" || l.type === "exercice")));
  const actif = connecte && lecon.accessible && lignes !== null && !apercu && !activite;
  return (
    <EtatLeconProvider key={leconId} termineeInitiale={terminees.has(leconId)} avecVideo={videoMesuree(lecon)} seuil={donnees.fiche.seuilVideo} actif={actif}>
      <CadreLecon
        connecte={connecte}
        espace={formateur ? "formateur" : undefined}
        titreFormation={donnees.fiche.titre}
        retour={retourEdition ?? (connecte ? "/mes-formations" : `/formations/${donnees.fiche.slug}`)}
        programme={
          <ProgrammeLecon
            fiche={donnees.fiche}
            leconId={leconId}
            connecte={connecte}
            terminees={terminees}
            scores={scores}
            statuts={statuts}
            retour={retourEdition ? { href: retourEdition, libelle: "Retour à l’édition" } : undefined}
            progression={progression}
          />
        }
        haut={
          <BarreHautLecon
            titreFormation={donnees.fiche.titre}
            adresseFormation={`/formations/${donnees.fiche.slug}`}
            leconId={leconId}
            suivante={suivante ? adresseLecon(donnees.fiche.slug, suivante.id) : undefined}
          />
        }
        barre={precedente || suivante || actif ? <BarreLecon fiche={donnees.fiche} leconId={leconId} /> : undefined}
        tiroir={
          <TiroirLecons pied={progression ? <ProgressionCours fiche={donnees.fiche} terminees={terminees} /> : undefined}>
            <ProgrammeMobile fiche={donnees.fiche} leconId={leconId} connecte={connecte} terminees={terminees} scores={scores} statuts={statuts} progression={progression} />
          </TiroirLecons>
        }
      >
        <ContenuLecon donnees={donnees} connecte={connecte} apercu={apercu} moi={moi} lienModifier={lienModifier} aInscrire={aInscrire} />
      </CadreLecon>
    </EtatLeconProvider>
  );
}

/** Page d'une leçon (spec du lot 1, §2) : NdLecon sur ordinateur, NdMobLecon sur téléphone. Ouverte à tous ; l'accès est décidé par la base. */
export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="m-5 h-96 rounded-panneau" />}>
      <Lecon params={params} />
    </Suspense>
  );
}
