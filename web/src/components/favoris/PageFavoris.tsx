"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Heading, Lead } from "@/components/ui/Text";
import { retirerFavori } from "@/lib/favoris/actions";
import { CoeurPlein } from "./CoeurPlein";

export type Favori = { id: string; titre: string; /** La carte de la formation (suivie ou non), rendue par le serveur. */ carte: ReactNode };

const AIDE = "Ajoutez une formation à vos favoris depuis sa fiche, pour la retrouver ici.";
const ECHEC = "Le favori n’a pas pu être retiré. Réessayez.";
// Grille de l'annexe (§0.2) : trois colonnes au plus, puis deux, puis une.
const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(232px,calc((100%-40px)/3))),1fr))] gap-5";

/**
 * Favoris (NdFavoris, NdFavorisVide) : les formations mises de côté depuis leur fiche, la plus récente d'abord.
 * Le cœur retire une formation, après confirmation ; la progression ne change pas.
 */
export function PageFavoris({ favoris }: { favoris: Favori[] }) {
  const [retires, setRetires] = useState<ReadonlySet<string>>(new Set());
  const [aRetirer, setARetirer] = useState<Favori | null>(null);
  const visibles = favoris.filter((f) => !retires.has(f.id));

  return (
    <div className="flex flex-col">
      <div className="min-w-0">
        <Heading level="page">Favoris</Heading>
        <Lead className="mt-2.5">Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement.</Lead>
      </div>
      <div aria-hidden="true" className="mt-5 h-px bg-separateur" />
      <div className="mt-8">
        {visibles.length === 0 ? (
          <EmptyState
            sansCadre
            icon={FavouriteIcon}
            title="Aucun favori pour le moment"
            description={AIDE}
            action={
              <Button asChild>
                <Link href="/formations">Parcourir le catalogue</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-6">
            <ul className={`m-0 list-none p-0 ${GRILLE}`}>
              {visibles.map((favori) => (
                <li key={favori.id} className="relative flex min-w-0 flex-col">
                  {favori.carte}
                  {/* Le cœur est à côté du lien de la carte, pas dedans : deux éléments interactifs distincts. */}
                  <button
                    type="button"
                    aria-label={`Retirer ${favori.titre} des favoris`}
                    onClick={() => setARetirer(favori)}
                    className="focus-etudium absolute top-4 right-4 flex size-[42px] cursor-pointer items-center justify-center rounded-champ border border-bordure bg-panneau text-texte transition-colors hover:bg-page"
                  >
                    <CoeurPlein />
                  </button>
                </li>
              ))}
            </ul>
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-carte bg-bleu-pale px-4 py-3.5">
              <span className="flex flex-none text-bleu">
                <Icon icon={FavouriteIcon} size={22} />
              </span>
              <span className="min-w-0 flex-[1_1_240px] text-sm leading-[22px] text-encre">{AIDE}</span>
              <Link href="/formations" className="focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline">
                Parcourir le catalogue
              </Link>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={aRetirer !== null}
        onOpenChange={(ouvert) => !ouvert && setARetirer(null)}
        title="Retirer des favoris ?"
        description={aRetirer ? `« ${aRetirer.titre} » ne figurera plus dans vos favoris. Votre progression ne change pas.` : ""}
        confirmLabel="Retirer"
        icon={FavouriteIcon}
        errorMessage={ECHEC}
        onConfirm={async () => {
          if (!aRetirer) return;
          const reponse = await retirerFavori(aRetirer.id);
          if (!reponse.ok) throw new Error(reponse.erreur);
          const id = aRetirer.id;
          setRetires((avant) => new Set([...avant, id]));
        }}
      />
    </div>
  );
}
