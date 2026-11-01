import { connection } from "next/server";
import { lireAbonnement } from "@/lib/abonnement/data";
import { BandeauRenouveler } from "./BandeauRenouveler";

/** En tête de l'Accueil : l'état de l'abonnement, lu à chaque visite (il dépend de la date du jour). */
export async function BandeauAbonnement() {
  await connection();
  const abonnement = await lireAbonnement();
  return <BandeauRenouveler abonnement={abonnement} maintenant={new Date().toISOString()} />;
}
