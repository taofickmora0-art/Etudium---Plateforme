import type { Espace } from "@/lib/auth/permissions";
import { requireSpace } from "@/lib/auth/require-space";
import type { PageAVenir } from "@/lib/pages-a-venir";
import { ComingSoon } from "./ComingSoon";

/** Page « Bientôt disponible » d'un espace réservé : rien n'est rendu avant la vérification du rôle. */
export async function ReservedComingSoon({ espace, page }: { espace: Exclude<Espace, "etudiant">; page: PageAVenir }) {
  await requireSpace(espace);
  return <ComingSoon page={page} />;
}
