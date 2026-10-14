"use client";

import Link from "next/link";
import { Video01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { PastilleNombre } from "@/components/ui/PastilleNombre";
import { cn } from "@/lib/cn";
import { useNouvellesSessions } from "./useNouvellesSessions";

/**
 * « Sessions live programmées » (spec promotion des sessions live, §3) : mène à la page Événements ; la pastille rouge
 * compte les sessions programmées depuis la dernière visite de cette page.
 */
export function BoutonSessionsProgrammees({ className }: { className?: string }) {
  const nouvelles = useNouvellesSessions();
  return (
    <Link
      href="/evenements"
      aria-label={nouvelles > 0 ? `Sessions live programmées, ${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""}` : "Sessions live programmées"}
      className={cn(
        "focus-etudium inline-flex h-10 flex-none items-center gap-2 rounded-full border border-bordure-carte bg-panneau px-3.5 text-sm leading-5 font-medium whitespace-nowrap text-encre no-underline transition-colors hover:border-bordure-champ max-sm:h-9 max-sm:px-3 max-sm:text-[13px]",
        className,
      )}
    >
      <Icon icon={Video01Icon} size={18} className="text-bleu" />
      Sessions live programmées
      {nouvelles > 0 && <PastilleNombre nombre={nouvelles} />}
    </Link>
  );
}
