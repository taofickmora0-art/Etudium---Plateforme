import { Banner } from "@/components/ui/Banner";
import { Heading } from "@/components/ui/Text";
import { lireSessions } from "@/lib/sessions/data";
import { PageEvenements } from "./PageEvenements";

/** Bandeau des pages des sessions live tant que la migration 0018 n'est pas appliquée. */
export function MigrationSessionsAbsente() {
  return (
    <Banner tone="attention" title="Les sessions live ne sont pas encore dans la base.">
      Appliquez la migration 0018 (guide « Ce qui te revient », section 23).
    </Banner>
  );
}

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
