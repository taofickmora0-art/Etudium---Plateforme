"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";

/**
 * Pages publiques montrées dans l'en-tête : seulement celles qui existent. Parcours, Tarifs et Communauté arrivent
 * avec la landing (tâche 1.12), « Vérifier un certificat » au lot 3.
 */
const LIENS = [{ href: "/formations", label: "Formations" }];

const LIEN = "focus-etudium flex h-[49px] items-center rounded-[14px] px-3.5 text-base font-medium text-texte no-underline transition-colors hover:bg-coque";

/** En-tête des pages publiques (NdCataloguePublic, NdFormationPublic, NdLanding). */
export function EnTetePublic() {
  const pathname = usePathname() ?? "";
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-5 pr-1">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Étudium, accueil"
          className="focus-etudium flex h-[49px] items-center gap-2.5 rounded-[14px] bg-coque pr-4 pl-[9px] text-[17px] font-bold tracking-[-0.02em] text-bleu no-underline"
        >
          <LogoMark />
          <span>Étudium</span>
        </Link>
        <nav aria-label="Site Étudium" className="flex flex-wrap items-center gap-3">
          {LIENS.map((lien) => {
            const actif = pathname === lien.href || pathname.startsWith(`${lien.href}/`);
            return (
              <Link key={lien.href} href={lien.href} aria-current={actif ? "page" : undefined} className={cn(LIEN, actif && "bg-coque")}>
                {lien.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/connexion"
          className="focus-etudium flex h-[49px] items-center gap-2 rounded-[14px] bg-coque px-4 text-base font-medium whitespace-nowrap text-texte no-underline transition-colors hover:bg-coque-survol"
        >
          Se connecter
        </Link>
        <Link
          href="/inscription"
          className="focus-etudium inline-flex h-[49px] items-center justify-center gap-2 rounded-[14px] bg-bleu px-[18px] text-base leading-none font-medium whitespace-nowrap text-white no-underline transition-colors hover:bg-bleu-survol"
        >
          Créer un compte gratuit
        </Link>
      </div>
    </header>
  );
}
