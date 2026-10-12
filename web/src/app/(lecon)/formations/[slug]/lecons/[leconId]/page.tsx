import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { CadreLecon } from "@/components/lecon/CadreLecon";
import { ContenuLecon } from "@/components/lecon/ContenuLecon";
import { BarreLecon } from "@/components/lecon/NavigationLecon";
import { ProgrammeLecon } from "@/components/lecon/ProgrammeLecon";
import { Skeleton } from "@/components/ui/Skeleton";
import { getFiche } from "@/lib/catalogue/data";
import { compteConnecte } from "@/lib/catalogue/visiteur";
import { getLecon } from "@/lib/lecon/data";
import { voisines } from "@/lib/lecon/regles";
import type { DonneesLecon } from "@/lib/lecon/types";

type Params = { params: Promise<{ slug: string; leconId: string }> };

/** « Découvrir l’interface · Maîtriser Microsoft Excel · Étudium ». La fiche est la page à référencer, pas la leçon. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, leconId } = await params;
  let titre = "Leçon introuvable · Étudium";
  try {
    const fiche = await getFiche(slug);
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
  let donnees: DonneesLecon | null;
  try {
    donnees = await getLecon(slug, leconId, connecte);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Formation non publiée, leçon d'une autre formation ou adresse inventée : page introuvable.
  if (!donnees) notFound();

  const { fiche } = donnees;
  // La progression (leçons terminées) arrive avec la tâche 1.7.
  const terminees = new Set<string>();
  const { precedente, suivante } = voisines(fiche.modules, leconId);
  return (
    <CadreLecon
      connecte={connecte}
      titreFormation={fiche.titre}
      retour={connecte ? "/mes-formations" : `/formations/${fiche.slug}`}
      programme={<ProgrammeLecon fiche={fiche} leconId={leconId} connecte={connecte} terminees={terminees} />}
      barre={precedente || suivante ? <BarreLecon fiche={fiche} leconId={leconId} /> : undefined}
    >
      <ContenuLecon donnees={donnees} connecte={connecte} terminees={terminees} />
    </CadreLecon>
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
