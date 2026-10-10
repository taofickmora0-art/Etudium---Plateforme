import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Conditions d’utilisation · Étudium" };

/** Page publique, ouverte depuis la case à cocher de l'inscription. Le texte définitif arrive au lot 1. */
export default function Page() {
  return (
    <AuthLayout aside="compte" back={{ href: "/inscription", label: "Retour à l’inscription" }}>
      <AuthHeading title="Conditions d’utilisation">
        Le texte complet arrive au lot 1, avec le site public. En attendant, vos données servent uniquement à faire fonctionner votre
        compte Étudium et ne sont jamais revendues.
      </AuthHeading>
      <Button asChild variant="contour" size="lg" className="w-full">
        <Link href="/inscription">Retour à l’inscription</Link>
      </Button>
    </AuthLayout>
  );
}
