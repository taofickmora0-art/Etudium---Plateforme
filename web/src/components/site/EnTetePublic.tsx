"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cancel01Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { LogoMark } from "@/components/brand/Logo";
import { IconButton } from "@/components/ui/IconButton";
import { cn } from "@/lib/cn";

/**
 * Liens du site (NdLanding §2). Les ancres sont écrites depuis la racine (« /#formules ») pour marcher aussi depuis le
 * catalogue et les fiches. « Tarifs » mène aux formules de la landing jusqu'à la page Tarifs du lot 2.
 */
export const LIENS_PUBLICS = [
  { href: "/#parcours", label: "Parcours" },
  { href: "/formations", label: "Formations" },
  { href: "/#formules", label: "Tarifs" },
  { href: "/#communaute", label: "Communauté" },
  { href: "/verifier", label: "Vérifier un certificat" },
];

const LIEN = "focus-etudium flex h-[49px] items-center rounded-[14px] px-3.5 text-base font-medium text-texte no-underline transition-colors hover:bg-coque";
const INSCRIPTION =
  "focus-etudium inline-flex items-center justify-center gap-2 rounded-[14px] bg-bleu px-[18px] text-base font-medium text-white no-underline transition-colors hover:bg-bleu-survol";

/**
 * En-tête des pages publiques (NdLanding, NdCataloguePublic, NdFormationPublic). Au téléphone (aucune maquette), il
 * tient sur une ligne : logo, « Se connecter » et un bouton « Menu » qui déplie les liens et l'inscription.
 */
export function EnTetePublic() {
  const pathname = usePathname() ?? "";
  // Le menu est ouvert sur une page : l'en-tête reste monté d'une page à l'autre du catalogue (même mise en page),
  // un changement d'adresse le referme donc de lui-même.
  const [ouvertSur, setOuvertSur] = useState<string | null>(null);
  const ouvert = ouvertSur === pathname;
  const fermer = () => setOuvertSur(null);
  const idMenu = useId();
  const bouton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      fermer();
      bouton.current?.focus();
    };
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  const actif = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-5 pr-1 max-sm:gap-2 max-sm:py-3 max-sm:pr-0">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Link
          href="/"
          aria-label="Étudium, accueil"
          className="focus-etudium flex h-[49px] items-center gap-2.5 rounded-[14px] bg-coque pr-4 pl-[9px] text-[17px] font-bold tracking-[-0.02em] text-bleu no-underline max-sm:h-10 max-sm:gap-2 max-sm:pr-3 max-sm:pl-[5px] max-sm:text-base"
        >
          <LogoMark />
          <span>Étudium</span>
        </Link>
        <nav aria-label="Site Étudium" className="flex flex-wrap items-center gap-3 max-sm:hidden">
          {LIENS_PUBLICS.map((lien) => (
            <Link key={lien.href} href={lien.href} aria-current={actif(lien.href) ? "page" : undefined} className={cn(LIEN, actif(lien.href) && "bg-coque")}>
              {lien.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex flex-wrap items-center gap-3 max-sm:flex-nowrap max-sm:gap-2">
        <Link
          href="/connexion"
          className="focus-etudium flex h-[49px] items-center gap-2 rounded-[14px] bg-coque px-4 text-base font-medium whitespace-nowrap text-texte no-underline transition-colors hover:bg-coque-survol max-sm:h-10 max-sm:px-3 max-sm:text-[15px]"
        >
          Se connecter
        </Link>
        <Link href="/inscription" className={cn(INSCRIPTION, "h-[49px] leading-none whitespace-nowrap max-sm:hidden")}>
          Créer mon compte gratuit
        </Link>
        <IconButton
          ref={bouton}
          icon={ouvert ? Cancel01Icon : Menu01Icon}
          label="Menu"
          aria-expanded={ouvert}
          aria-controls={ouvert ? idMenu : undefined}
          onClick={() => setOuvertSur((o) => (o === pathname ? null : pathname))}
          className="size-10 rounded-[14px] sm:hidden"
        />
      </div>
      {ouvert && (
        <nav
          id={idMenu}
          aria-label="Menu du site"
          className="flex basis-full flex-col gap-1 rounded-carte bg-panneau p-2 shadow-[0_18px_44px_rgba(11,24,201,0.12)] sm:hidden"
        >
          {LIENS_PUBLICS.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              aria-current={actif(lien.href) ? "page" : undefined}
              onClick={fermer}
              className={cn(LIEN, "h-auto min-h-12 px-3 text-[15px]", actif(lien.href) && "bg-coque")}
            >
              {lien.label}
            </Link>
          ))}
          <Link href="/inscription" onClick={fermer} className={cn(INSCRIPTION, "mt-1 min-h-12 py-3 text-center text-[15px] leading-tight")}>
            Créer mon compte gratuit
          </Link>
        </nav>
      )}
    </header>
  );
}
