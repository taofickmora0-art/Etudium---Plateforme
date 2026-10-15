import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { CadreLecon } from "@/components/lecon/CadreLecon";
import { EtatLeconProvider } from "@/components/lecon/EtatLecon";
import { ContenuLecon } from "@/components/lecon/ContenuLecon";
import { BarreLecon } from "@/components/lecon/NavigationLecon";
import { ProgrammeLecon } from "@/components/lecon/ProgrammeLecon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Apercu } from "@/components/lecon/BandeauApercu";
import { ficheApercu } from "@/lib/catalogue/apercu";
import { getFiche } from "@/lib/catalogue/data";
import type { FicheFormation } from "@/lib/catalogue/types";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { getLeconDans } from "@/lib/lecon/data";
import { voisines } from "@/lib/lecon/regles";
import { lireProgression } from "@/lib/progression/data";
import { etatFormation } from "@/lib/progression/regles";
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
  try {
    // Une formation non publiée ne s'ouvre qu'en aperçu, pour l'équipe et son formateur (refonte des formations, §3.5).
    fiche = await getFiche(slug);
    if (!fiche && connecte) {
      fiche = await ficheApercu(slug);
      apercuFormation = fiche !== null;
    }
    [donnees, lignes] = fiche ? await Promise.all([getLeconDans(fiche, leconId, connecte), connecte ? lireProgression() : null]) : [null, null];
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
  const actif = connecte && lecon.accessible && lignes !== null && !apercu;
  return (
    <EtatLeconProvider key={leconId} termineeInitiale={terminees.has(leconId)} avecVideo={lecon.video !== null} seuil={donnees.fiche.seuilVideo} actif={actif}>
      <CadreLecon
        connecte={connecte}
        titreFormation={donnees.fiche.titre}
        retour={connecte ? "/mes-formations" : `/formations/${donnees.fiche.slug}`}
        programme={<ProgrammeLecon fiche={donnees.fiche} leconId={leconId} connecte={connecte} terminees={terminees} />}
        barre={precedente || suivante || actif ? <BarreLecon fiche={donnees.fiche} leconId={leconId} /> : undefined}
      >
        <ContenuLecon donnees={donnees} connecte={connecte} terminees={terminees} apercu={apercu} />
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
