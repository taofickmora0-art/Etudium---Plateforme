import { BookOpen01Icon, Route01Icon, StarIcon, TeachingIcon } from "@hugeicons/core-free-icons";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { compterContenus } from "@/lib/admin/data";
import type { ResumeContenus } from "@/lib/admin/types";
import { siTablesAbsentes } from "./TablesAbsentes";

/** « 1 fiche », « 2 fiches », « 0 brouillon » (zéro reste au singulier en français). */
export const nombre = (n: number, singulier: string, pluriel: string) => `${n} ${n > 1 ? pluriel : singulier}`;

/** Les rubriques du back-office, avec ce qu'elles contiennent (les avis : à partir de la migration 0010). */
export async function ResumeBackOffice() {
  let resume: ResumeContenus;
  try {
    resume = await compterContenus();
  } catch (erreur) {
    return siTablesAbsentes(erreur);
  }
  const formations = [
    nombre(resume.publiees, "publiée", "publiées"),
    nombre(resume.brouillons, "brouillon", "brouillons"),
    nombre(resume.archivees, "archivée", "archivées"),
  ].join(" · ");
  return (
    <List label="Rubriques du back-office" className="max-w-[680px]">
      <ListRow leading={<IconTile icon={Route01Icon} size={44} />} title="Parcours" subtitle={nombre(resume.parcours, "parcours", "parcours")} href="/admin/parcours" />
      <ListRow leading={<IconTile icon={TeachingIcon} size={44} />} title="Formateurs" subtitle={nombre(resume.formateurs, "fiche", "fiches")} href="/admin/formateurs" />
      <ListRow leading={<IconTile icon={BookOpen01Icon} size={44} />} title="Formations" subtitle={formations} href="/admin/formations" />
      {resume.avis !== null && (
        <ListRow
          leading={<IconTile icon={StarIcon} size={44} />}
          title="Avis"
          subtitle={`${nombre(resume.avis, "avis", "avis")} · ${nombre(resume.avisMasques, "masqué", "masqués")}`}
          href="/admin/avis"
        />
      )}
    </List>
  );
}
