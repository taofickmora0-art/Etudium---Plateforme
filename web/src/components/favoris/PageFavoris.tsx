"use client";

import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { FavouriteIcon } from "@hugeicons/core-free-icons";
import { CarteDeLivre } from "@/components/bibliotheque/CarteDeLivre";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { GRILLE_CARTES } from "@/components/ui/grilles";
import { Icon } from "@/components/ui/Icon";
import { Heading, Lead } from "@/components/ui/Text";
import { retirerFavoriLivre } from "@/lib/bibliotheque/actions";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import { retirerFavori } from "@/lib/favoris/actions";
import { CoeurPlein } from "./CoeurPlein";

export type Favori = { id: string; titre: string; /** La carte de la formation (suivie ou non), rendue par le serveur. */ carte: ReactNode };

const AIDE = "Ajoutez une formation à vos favoris depuis sa fiche, pour la retrouver ici.";
const ECHEC = "Le favori n’a pas pu être retiré. Réessayez.";

/** Ce que le cœur va retirer : une formation ou un livre (la Bibliothèque, 0074). */
type ARetirer = { type: "formation"; id: string; titre: string } | { type: "livre"; id: string; titre: string };

/** Le cœur plein d'une carte : à côté du lien de la carte, pas dedans (deux éléments interactifs distincts). */
function BoutonRetirer({ titre, onClick }: { titre: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`Retirer ${titre} des favoris`}
      onClick={onClick}
      className="focus-etudium absolute top-4 right-4 flex size-[42px] cursor-pointer items-center justify-center rounded-champ border border-bordure bg-panneau text-texte transition-colors hover:bg-page"
    >
      <CoeurPlein />
    </button>
  );
}

/** Une section titrée de la page (« Formations », « Livres »), quand la page a les deux sortes de favoris. */
function Section({ titre, avecTitre, children }: { titre: string; avecTitre: boolean; children: ReactNode }) {
  const id = useId();
  if (!avecTitre) return <>{children}</>;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <Heading level="section">
        <span id={id}>{titre}</span>
      </Heading>
      {children}
    </section>
  );
}

/**
 * Favoris (NdFavoris, NdFavorisVide) : les formations mises de côté depuis leur fiche, la plus récente d'abord, puis les
 * livres de la Bibliothèque (section « Livres », s'il y en a). Le cœur retire une formation ou un livre, après
 * confirmation ; la progression et la lecture ne changent pas.
 */
export function PageFavoris({ favoris, livres = [] }: { favoris: Favori[]; livres?: CarteLivre[] }) {
  const [retires, setRetires] = useState<ReadonlySet<string>>(new Set());
  const [aRetirer, setARetirer] = useState<ARetirer | null>(null);
  const visibles = favoris.filter((f) => !retires.has(`formation:${f.id}`));
  const livresVisibles = livres.filter((l) => !retires.has(`livre:${l.id}`));
  // Les sections ne sont titrées que si la page a des livres (sinon, la page des formations d'avant).
  const avecLivres = livres.length > 0;

  return (
    <div className="flex flex-col">
      <div className="min-w-0">
        <Heading level="page">Favoris</Heading>
        <Lead className="mt-2.5">
          {avecLivres
            ? "Les formations et les livres que vous avez marqués d’un cœur, pour les retrouver rapidement."
            : "Les formations que vous avez marquées d’un cœur, pour les retrouver rapidement."}
        </Lead>
      </div>
      <div aria-hidden="true" className="mt-5 h-px bg-separateur" />
      <div className="mt-8">
        {visibles.length === 0 && livresVisibles.length === 0 ? (
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
          <div className="flex min-w-0 flex-col gap-8">
            {visibles.length > 0 && (
              <Section titre="Formations" avecTitre={avecLivres}>
                <div className="flex min-w-0 flex-col gap-6">
                  <ul className={`m-0 list-none p-0 ${GRILLE_CARTES}`}>
                    {visibles.map((favori) => (
                      <li key={favori.id} className="relative flex min-w-0 flex-col">
                        {favori.carte}
                        <BoutonRetirer titre={favori.titre} onClick={() => setARetirer({ type: "formation", id: favori.id, titre: favori.titre })} />
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
              </Section>
            )}
            {livresVisibles.length > 0 && (
              <Section titre="Livres" avecTitre>
                <ul className={`m-0 list-none p-0 ${GRILLE_CARTES}`}>
                  {livresVisibles.map((livre) => (
                    <li key={livre.id} className="relative flex min-w-0 flex-col [&>*:first-child]:flex-1">
                      <CarteDeLivre livre={livre} sansEtiquette />
                      <BoutonRetirer titre={livre.titre} onClick={() => setARetirer({ type: "livre", id: livre.id, titre: livre.titre })} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={aRetirer !== null}
        onOpenChange={(ouvert) => !ouvert && setARetirer(null)}
        title="Retirer des favoris ?"
        description={
          aRetirer
            ? `« ${aRetirer.titre} » ne figurera plus dans vos favoris. ${aRetirer.type === "livre" ? "Votre lecture ne change pas." : "Votre progression ne change pas."}`
            : ""
        }
        confirmLabel="Retirer"
        icon={FavouriteIcon}
        errorMessage={ECHEC}
        onConfirm={async () => {
          if (!aRetirer) return;
          const reponse = aRetirer.type === "livre" ? await retirerFavoriLivre(aRetirer.id) : await retirerFavori(aRetirer.id);
          if (!reponse.ok) throw new Error(reponse.erreur);
          const cle = `${aRetirer.type}:${aRetirer.id}`;
          setRetires((avant) => new Set([...avant, cle]));
        }}
      />
    </div>
  );
}
