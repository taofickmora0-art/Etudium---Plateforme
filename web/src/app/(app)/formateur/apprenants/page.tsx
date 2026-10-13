import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSpace } from "@/lib/auth/require-space";

/** Ancienne adresse de la page « Étudiants » (nom du design) : un formateur y est renvoyé. */
async function Redirection(): Promise<null> {
  await requireSpace("formateur");
  redirect("/formateur/etudiants");
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Redirection />
    </Suspense>
  );
}
