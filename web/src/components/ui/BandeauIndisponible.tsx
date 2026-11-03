import { INDISPONIBLE } from "@/lib/indisponible";
import { Banner } from "./Banner";

/**
 * Le bandeau d'une fonction absente de la base, pour un étudiant, un formateur ou un visiteur : un message neutre, sans
 * numéro de migration ni guide (l'équipe les lit dans le back-office).
 */
export function BandeauIndisponible({ className }: { className?: string }) {
  return <Banner tone="information" title={INDISPONIBLE} className={className} />;
}
