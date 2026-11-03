import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarreEtatLivre } from "@/components/admin/bibliotheque/BarreEtatLivre";
import { BibliothequeAbsente } from "@/components/admin/bibliotheque/BibliothequeAbsente";
import { FormulaireLivre } from "@/components/admin/bibliotheque/FormulaireLivre";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Skeleton } from "@/components/ui/Skeleton";
import { compter } from "@/lib/admin/parcours-chiffres";
import { listParcours } from "@/lib/admin/data";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { requireDomaine } from "@/lib/auth/require-domaine";
import { lireBibliothequeAdmin, listCategoriesLivres } from "@/lib/bibliotheque/data";

export const metadata: Metadata = { title: "Livre · Back-office · Étudium" };

type Params = { params: Promise<{ id: string }> };

/** La fiche d'un livre : son état et ses actions en haut, ses chiffres, puis le formulaire. */
async function FicheLivre({ params }: Params) {
  await requireDomaine("contenus");
  const { id } = await params;
  let parcours: ParcoursAdmin[];
  try {
    parcours = await listParcours();
  } catch (erreur) {
    return siTablesAbsentes(erreur, { equipe: true });
  }
  const [donnees, categories] = await Promise.all([lireBibliothequeAdmin(id), listCategoriesLivres()]);
  if (!donnees || !categories) {
    return (
      <PageAdmin titre="Bibliothèque" fil={[{ label: "Bibliothèque", href: "/admin/bibliotheque" }]}>
        <BibliothequeAbsente />
      </PageAdmin>
    );
  }
  const livre = donnees.livres[0];
  if (!livre) notFound();
  const chiffres = [
    compter(livre.lectures, "lecture"),
    `${livre.lecturesTerminees.toLocaleString("fr-FR")} terminée${livre.lecturesTerminees > 1 ? "s" : ""}`,
    livre.telechargeable ? compter(livre.telechargements, "téléchargement") : null,
    compter(livre.favoris, "favori"),
    livre.formations > 0 ? `recommandé par ${compter(livre.formations, "formation")}` : null,
  ].filter(Boolean);
  return (
    <PageAdmin
      titre={livre.titre}
      description={livre.statut === "brouillon" ? "Brouillon : visible seulement par l’équipe." : chiffres.join(" · ")}
      fil={[{ label: "Bibliothèque", href: "/admin/bibliotheque" }, { label: livre.titre }]}
      action={<BarreEtatLivre id={livre.id} statut={livre.statut} />}
    >
      <FormulaireLivre key={`${livre.id}-${livre.modifieLe ?? ""}`} livre={livre} categories={categories} parcours={parcours} />
    </PageAdmin>
  );
}

export default function Page({ params }: Params) {
  return (
    <Suspense fallback={<Skeleton className="h-96 max-w-[680px] rounded-carte" />}>
      <FicheLivre params={params} />
    </Suspense>
  );
}
