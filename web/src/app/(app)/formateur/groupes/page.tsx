import { Suspense } from "react";
import type { Metadata } from "next";
import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { VoletVide } from "@/components/ui/DeuxVolets";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Groupes · Espace formateur · Étudium" };

async function Contenu() {
  await requireSpace("formateur");
  return <VoletVide icon={UserGroupIcon} titre="Choisissez un groupe" description="Ouvrez un groupe à gauche pour lire la discussion et y écrire." />;
}

/**
 * Les groupes de discussion du formateur (restructuration R1 : il n'a plus l'espace étudiant) : la liste est à gauche
 * (mise en page commune) ; ici, le volet vide. Réservé à son espace, rien n'est rendu avant la vérification.
 */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <Contenu />
    </Suspense>
  );
}
