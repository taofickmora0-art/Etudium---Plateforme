import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { EmptyState } from "@/components/ui/EmptyState";
import { Heading, Lead } from "@/components/ui/Text";
import { getShellUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Accueil · Étudium" };

async function Salutation() {
  const prenom = (await getShellUser())?.prenom;
  return <Heading level="page">{prenom ? `Bonjour, ${prenom}` : "Bonjour"}</Heading>;
}

/** Accueil de l'espace connecté (NdAccueil) : salutation ; le tableau de bord arrive au lot 1. */
export default function AccueilPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <Suspense fallback={<Heading level="page">Bonjour</Heading>}>
            <Salutation />
          </Suspense>
          <Lead className="mt-2.5">Continuez votre apprentissage et atteignez vos objectifs.</Lead>
        </div>
        <Button asChild>
          <Link href="/formations">Explorer le catalogue</Link>
        </Button>
      </div>
      <EmptyState
        illustration={<CourseIllustration parcours="academique" size={64} />}
        title="Votre tableau de bord arrive bientôt"
        description="Progression, formations en cours et prochaines sessions arrivent au lot 1."
      />
    </div>
  );
}
