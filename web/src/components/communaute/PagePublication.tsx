import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { CHEMINS_COMMUNAUTE, type EspaceCommunaute } from "@/lib/communaute/chemins";
import { lirePublication } from "@/lib/communaute/data";
import { MigrationCommunauteAbsente } from "./cadre";
import { moiCommunaute } from "./ContenuCommunaute";
import { DetailPublication } from "./DetailPublication";

/**
 * La page d'une publication (spec, §3) : l'adresse que copie « Copier le lien » et que donne la notification « Nouvelle
 * réponse ». Introuvable, ou d'un espace fermé au compte : la page introuvable. Dans l'espace formateur
 * (restructuration R1), le fil d'Ariane mène à sa communauté.
 */
export async function PagePublication({ id, espace = "etudiant" }: { id: string; espace?: EspaceCommunaute }) {
  const chemins = CHEMINS_COMMUNAUTE[espace];
  const [lecture, moi] = await Promise.all([lirePublication(id), moiCommunaute()]);
  if (lecture.migrationAbsente) return <MigrationCommunauteAbsente />;
  const publication = lecture.donnees;
  if (!publication) notFound();
  const nom = `${publication.auteur.prenom} ${publication.auteur.nom}`.trim();
  return (
    <div className="flex max-w-[760px] min-w-0 flex-col gap-6">
      <Breadcrumb items={[{ label: chemins.libelleAccueil, href: chemins.accueil }, { label: "Publication" }]} />
      <h1 className="sr-only">{nom ? `Publication de ${nom}` : "Publication"}</h1>
      <DetailPublication publication={publication} moi={moi} maintenant={new Date().toISOString()} espace={espace} />
    </div>
  );
}
