"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import type { TriFil } from "@/lib/communaute/types";

// « Programmées » est un onglet sous le champ de publication, pas un tri.
const LIBELLES: Record<TriFil, string> = { recentes: "Les plus récentes", populaires: "Les plus populaires", enregistrees: "Mes enregistrements", programmees: "Mes programmées" };
const TRIS: TriFil[] = ["recentes", "populaires", "enregistrees"];

/** « Trier par : » (design NdCommunaute ; spec du fil « Actualités », §4). */
export function MenuTri({ valeur, onChange }: { valeur: TriFil; onChange: (tri: TriFil) => void }) {
  return (
    <div className="ml-auto flex items-center justify-end gap-2">
      <span className="text-sm leading-5 text-discret max-sm:text-[13px]">Trier par :</span>
      <Menu
        label="Trier les publications"
        trigger={
          <button
            type="button"
            className="focus-etudium inline-flex h-[34px] items-center gap-1.5 rounded-puce px-2.5 text-sm leading-5 font-semibold text-encre transition-colors hover:bg-coque max-sm:text-[13px]"
          >
            {LIBELLES[valeur]}
            <Icon icon={ArrowDown01Icon} size={16} />
          </button>
        }
        items={TRIS.map((tri) => ({ label: LIBELLES[tri], current: tri === valeur, onSelect: () => onChange(tri) }))}
      />
    </div>
  );
}
