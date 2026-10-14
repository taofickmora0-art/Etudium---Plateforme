import { Banner } from "@/components/ui/Banner";
import { Heading } from "@/components/ui/Text";
import { lireNotifications } from "@/lib/notifications/data";
import { NOMBRE_PAGE } from "@/lib/notifications/regles";
import { PageNotifications } from "./PageNotifications";

/** Les 20 premières notifications du compte ; avant la migration 0016, un bandeau. */
export async function ContenuNotifications() {
  const lecture = await lireNotifications({ nombre: NOMBRE_PAGE });
  if (lecture.migrationAbsente) {
    return (
      <div className="flex flex-col gap-5">
        <Heading level="page">Notifications</Heading>
        <Banner tone="attention" title="Les notifications ne sont pas encore dans la base.">
          Appliquez la migration 0016 (guide « Ce qui te revient », section 21).
        </Banner>
      </div>
    );
  }
  return <PageNotifications initial={lecture.donnees} />;
}
