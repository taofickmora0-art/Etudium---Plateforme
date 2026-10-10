import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { EnvError, getPublicEnv } from "@/lib/env";
import { checkSupabase } from "@/lib/supabase/health";

type Etat = { ton: "ok" | "erreur"; titre: string; detail: string };

async function lireEtat(): Promise<Etat> {
  let env;
  try {
    env = getPublicEnv();
  } catch (error) {
    if (error instanceof EnvError) return { ton: "erreur", titre: "Configuration manquante", detail: error.message };
    throw error;
  }
  const status = await checkSupabase(env);
  if (status.ok) return { ton: "ok", titre: "Base connectée", detail: "Projet Supabase de test joignable." };
  return { ton: "erreur", titre: "Base non connectée", detail: status.message };
}

function Encadre({ ton, titre, detail }: Etat) {
  const couleurs = ton === "ok" ? "bg-reussite-fond text-reussite-texte" : "bg-erreur-fond text-erreur-texte";
  return (
    <div role="status" className={`flex flex-col gap-1 rounded-2xl px-4 py-3.5 ${couleurs}`}>
      <strong className="text-[15px] leading-[22px] font-semibold">{titre}</strong>
      <span className="text-sm leading-[22px] text-encre">{detail}</span>
    </div>
  );
}

async function EtatConnexion() {
  await connection(); // la vérification se fait à chaque visite, jamais au moment de la compilation
  return <Encadre {...await lireEtat()} />;
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-page px-5 pb-5">
      <header className="flex items-center py-5">
        <span className="flex h-[49px] items-center rounded-[14px] bg-coque pr-4 pl-2.5">
          <Logo />
        </span>
      </header>
      <div className="flex flex-1 rounded-[32px] bg-coque p-5">
        <main className="flex flex-1 items-center justify-center rounded-[28px] bg-panneau px-6 py-10 sm:px-14">
          <div className="flex w-full max-w-[460px] flex-col gap-[18px]">
            <div>
              <h1 className="text-[32px] leading-[38px] font-medium tracking-[-0.025em] text-[#262628] text-balance">
                L’application Étudium tourne en local
              </h1>
              <p className="mt-2.5 text-[15px] leading-6 text-discret">
                Cette page provisoire vérifie que tout est branché. Elle sera remplacée par l’accueil au lot 1.
              </p>
            </div>
            <Suspense
              fallback={
                <div role="status" className="rounded-2xl bg-coque px-4 py-3.5 text-sm text-discret">
                  Vérification de la connexion à la base…
                </div>
              }
            >
              <EtatConnexion />
            </Suspense>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/accueil">Ouvrir l’application</Link>
              </Button>
              <Button asChild variant="contour">
                <Link href="/vitrine">Vitrine des composants</Link>
              </Button>
            </div>
            <p className="text-xs leading-[18px] text-discret">Tâche 0.1 · environnement local</p>
          </div>
        </main>
      </div>
    </div>
  );
}
