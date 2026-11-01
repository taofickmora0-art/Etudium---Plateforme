import { notFound } from "next/navigation";
import { lireRecu } from "@/lib/abonnement/data";
import { Recu } from "./Recu";

/** Le reçu demandé ; la base ne le rend qu'à son compte et à l'équipe, sinon la page est introuvable. */
export async function ContenuRecu({ numero }: { numero: string }) {
  const recu = await lireRecu(numero);
  if (!recu) notFound();
  return <Recu recu={recu} />;
}
