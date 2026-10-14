import { Heading } from "@/components/ui/Text";
import { lireSessions } from "@/lib/sessions/data";
import { MigrationSessionsAbsente } from "./cadre";
import { PageEvenements } from "./PageEvenements";

/** Les sessions à venir ; avant la migration 0018, un bandeau. */
export async function ContenuEvenements() {
  const lecture = await lireSessions("a_venir");
  if (lecture.migrationAbsente) {
    return (
      <div className="flex flex-col gap-5">
        <Heading level="page">Événements</Heading>
        <MigrationSessionsAbsente />
      </div>
    );
  }
  return <PageEvenements initial={lecture.donnees} />;
}
