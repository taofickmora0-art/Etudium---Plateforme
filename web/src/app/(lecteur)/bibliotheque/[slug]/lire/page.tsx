import { Suspense } from "react";
import type { Metadata } from "next";
import { ContenuLecteur } from "@/components/bibliotheque/ContenusBibliotheque";
import { Spinner } from "@/components/ui/Spinner";
import { lireFicheLivre } from "@/lib/bibliotheque/data";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** « Lecture · Réussir son mémoire · Étudium ». La fiche est la page à référencer, pas le lecteur. */
export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  let titre = "Lecture · Étudium";
  try {
    const fiche = await lireFicheLivre(slug);
    if (fiche && fiche !== "absente") titre = `Lecture · ${fiche.titre} · Étudium`;
  } catch {
    // Base injoignable : la page elle-même affichera l'erreur.
  }
  return { title: titre, robots: { index: false } };
}

async function Lecteur({ params, searchParams }: Props) {
  const [{ slug }, recherche] = await Promise.all([params, searchParams]);
  return <ContenuLecteur slug={slug} params={recherche} />;
}

/** Le lecteur d'un livre (spec du 3 novembre 2026, §2) : plein écran, sans la coque de l'appli. */
export default function Page(props: Props) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex h-dvh flex-col items-center justify-center gap-3 bg-page text-sm text-discret">
          <Spinner size={24} />
          Ouverture du livre…
        </div>
      }
    >
      <Lecteur {...props} />
    </Suspense>
  );
}
