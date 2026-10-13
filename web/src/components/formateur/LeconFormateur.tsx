import Link from "next/link";
import { notFound } from "next/navigation";
import { LeconForm } from "@/components/admin/LeconForm";
import { PageAdmin } from "@/components/admin/PageAdmin";
import { RessourcesEditor } from "@/components/admin/RessourcesEditor";
import { siTablesAbsentes } from "@/components/admin/TablesAbsentes";
import { Button } from "@/components/ui/Button";
import { getLeconAdmin } from "@/lib/admin/data";
import type { LeconAdmin } from "@/lib/admin/types";
import { estMaFormation } from "@/lib/formateur/data";
import { MES_FORMATIONS, RACINE_FORMATEUR } from "./cadre";

type Params = { params: Promise<{ id: string; leconId: string }> };

/** Une leçon d'une de ses formations, dans l'espace formateur (même page qu'au back-office). */
export async function LeconFormateur({ params }: Params) {
  const { id, leconId } = await params;
  if (!(await estMaFormation(id))) notFound();
  let lecon: LeconAdmin | null;
  try {
    lecon = await getLeconAdmin(leconId);
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  // Une leçon n'est ouverte que sous sa propre formation.
  if (!lecon || lecon.formationId !== id) notFound();
  const programme = `/formateur/formations/${id}?onglet=programme`;
  return (
    <PageAdmin
      titre={lecon.titre}
      racine={RACINE_FORMATEUR}
      fil={[MES_FORMATIONS, { label: lecon.formationTitre, href: programme }, { label: lecon.titre }]}
      action={
        <Button asChild variant="contour">
          <Link href={programme}>Retour au programme</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <LeconForm lecon={lecon} />
        <RessourcesEditor lecon={lecon} />
      </div>
    </PageAdmin>
  );
}
