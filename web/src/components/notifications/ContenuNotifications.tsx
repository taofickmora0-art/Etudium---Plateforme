import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Heading } from "@/components/ui/Text";
import { lireNotifications } from "@/lib/notifications/data";
import { NOMBRE_PAGE } from "@/lib/notifications/regles";
import { PageNotifications } from "./PageNotifications";

/** Les 20 premières notifications du compte (étudiant ou formateur) ; avant la migration 0016, un bandeau neutre. */
export async function ContenuNotifications() {
  const lecture = await lireNotifications({ nombre: NOMBRE_PAGE });
  if (lecture.migrationAbsente) {
    return (
      <div className="flex flex-col gap-5">
        <Heading level="page">Notifications</Heading>
        <BandeauIndisponible />
      </div>
    );
  }
  return <PageNotifications initial={lecture.donnees} maintenant={new Date().toISOString()} />;
}
