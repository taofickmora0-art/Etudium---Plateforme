import type { Metadata } from "next";
import { Heading } from "@/components/ui/Text";

export const metadata: Metadata = { title: "Toutes les formations · Étudium" };

/** Catalogue des formations (rempli à l'étape suivante de la tâche 1.3). */
export default function Page() {
  return <Heading level="page">Toutes les formations</Heading>;
}
