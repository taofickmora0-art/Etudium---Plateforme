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
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { getLeconDans } from "@/lib/lecon/data";
import { videoMesuree, voisines } from "@/lib/lecon/regles";
import { lireProgression } from "@/lib/progression/data";
import { etatFormation } from "@/lib/progression/regles";
import { lireMesScores } from "@/lib/quiz/data";
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
  try {
    // Une formation non publiée ne s'ouvre qu'en aperçu, pour l'équipe et son formateur (refonte des formations, §3.5).
    fiche = await getFiche(slug);
    if (!fiche && connecte) {
      fiche = await ficheApercu(slug);
      apercuFormation = fiche !== null;
    }
    [donnees, lignes] = fiche ? await Promise.all([getLeconDans(fiche, leconId, connecte), connecte ? lireProgression() : null]) : [null, null];
    [moi, lienModifier, scores] = await Promise.all([
      connecte && donnees?.discussion ? moiCommunaute() : null,
      connecte && donnees ? lienModifierLecon(donnees.fiche.id, leconId) : null,
      // Le meilleur score de chaque quiz, dans le programme (lot 3).
      connecte && donnees && donnees.fiche.modules.some((m) => m.lecons.some((l) => l.type === "quiz")) ? lireMesScores(donnees.fiche.id) : {},
    ]);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Formation non publiée (sauf aperçu), leçon d'une autre formation ou adresse inventée : page introuvable.
  if (!donnees) notFound();

  const { lecon } = donnees;
  // Une leçon en brouillon n'est lue que par l'équipe et le formateur : c'est un aperçu, comme une formation non publiée.
  const enBrouillon = donnees.fiche.modules.some((m) => m.lecons.some((l) => l.id === leconId && l.publiee === false));
  const apercu: Apercu | null = apercuFormation ? "formation" : enBrouillon ? "lecon" : null;
  const terminees = lignes ? etatFormation(donnees.fiche, lignes).terminees : new Set<string>();
  const { precedente, suivante } = voisines(donnees.fiche.modules, leconId);
  // Bouton de fin : compte connecté, leçon ouverte, progression disponible en base (0007, 0008), et pas en aperçu.
  // Un quiz ne se termine pas : il se réussit (lot 3) ; seul « Leçon suivante » reste.
  const quiz = donnees.fiche.modules.some((m) => m.lecons.some((l) => l.id === leconId && l.type === "quiz"));
  const actif = connecte && lecon.accessible && lignes !== null && !apercu && !quiz;
  return (
    <EtatLeconProvider key={leconId} termineeInitiale={terminees.has(leconId)} avecVideo={videoMesuree(lecon)} seuil={donnees.fiche.seuilVideo} actif={actif}>
      <CadreLecon
        connecte={connecte}
        titreFormation={donnees.fiche.titre}
        retour={connecte ? "/mes-formations" : `/formations/${donnees.fiche.slug}`}
        programme={<ProgrammeLecon fiche={donnees.fiche} leconId={leconId} connecte={connecte} terminees={terminees} scores={scores} />}
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
          <TiroirLecons pied={connecte ? <ProgressionCours fiche={donnees.fiche} terminees={terminees} /> : undefined}>
            <ProgrammeMobile fiche={donnees.fiche} leconId={leconId} connecte={connecte} terminees={terminees} scores={scores} />
          </TiroirLecons>
        }
      >
        <ContenuLecon donnees={donnees} connecte={connecte} apercu={apercu} moi={moi} lienModifier={lienModifier} />
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
