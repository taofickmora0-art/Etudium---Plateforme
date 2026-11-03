"use client";

import { useId, useState, useTransition } from "react";
import Image from "next/image";
import { ArrowDown01Icon, ArrowUp01Icon, Book02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { Heading } from "@/components/ui/Text";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { ajouterLivreFormation, rangerLivreFormation, retirerLivreFormation } from "@/lib/bibliotheque/actions";
import { ETATS_LIVRE, MIGRATION_BIBLIOTHEQUE, TON_ETAT_LIVRE } from "@/lib/bibliotheque/regles";
import type { LivreRecommande } from "@/lib/bibliotheque/types";
import { urlCouverture } from "@/lib/couvertures/adresse";

type Props = {
  formationId: string;
  /** Les livres recommandés, dans leur ordre ; null sans la 0074 (le bandeau le dit, à l'équipe). */
  recommandes: LivreRecommande[] | null;
  /** Les livres publiés de la Bibliothèque, à proposer. */
  publies: { id: string; titre: string; auteur: string }[];
};

type Resultat = { ok: boolean; message?: string };
const ECHEC = "L’action n’a pas abouti. Vérifiez votre connexion, puis réessayez.";

/**
 * « Livres recommandés » de la fiche d'une formation au back-office (Bibliothèque, 0074) : choisir des livres publiés,
 * en retirer, les ranger. Les apprenants les verront dans « Pour aller plus loin ». Un livre archivé ensuite reste dans la
 * liste, marqué : il n'est plus montré aux apprenants tant qu'il n'est pas republié.
 */
export function LivresRecommandes({ formationId, recommandes, publies }: Props) {
  const { toast } = useToast();
  const titre = useId();
  const champ = useId();
  const [choisi, setChoisi] = useState("");
  const [enCours, demarrer] = useTransition();

  const agir = (action: () => Promise<Resultat>, succes?: string, apres?: () => void) =>
    demarrer(async () => {
      let resultat: Resultat;
      try {
        resultat = await action();
      } catch {
        resultat = { ok: false, message: ECHEC };
      }
      if (!resultat.ok) {
        toast({ tone: "erreur", title: resultat.message ?? ECHEC });
        return;
      }
      if (succes) toast({ tone: "reussite", title: succes });
      apres?.();
    });

  const deja = new Set((recommandes ?? []).map((l) => l.id));
  const proposes = publies.filter((l) => !deja.has(l.id));

  return (
    <section aria-labelledby={titre} className="flex max-w-[680px] flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
      <Heading level="card" as="h2">
        <span id={titre}>Livres recommandés</span>
      </Heading>
      <p className="m-0 -mt-1.5 text-[13px] leading-5 text-pretty text-discret">
        « Pour aller plus loin » : des livres de la Bibliothèque proposés aux apprenants de cette formation.
      </p>
      {recommandes === null ? (
        <Banner tone="attention" title="La Bibliothèque n’est pas encore dans la base">
          {MIGRATION_BIBLIOTHEQUE}
        </Banner>
      ) : (
        <>
          {recommandes.length === 0 ? (
            <p className="m-0 text-[13px] leading-5 text-discret">Aucun livre recommandé pour le moment.</p>
          ) : (
            <ol aria-label="Livres recommandés, dans l’ordre" className="m-0 flex list-none flex-col gap-2 p-0">
              {recommandes.map((l, i) => {
                const image = urlCouverture(l.couverture);
                return (
                  <li key={l.id} className="flex items-center gap-3 rounded-bouton border border-bordure-carte py-2 pr-2 pl-2.5">
                    <span className="relative aspect-[2/3] w-9 flex-none overflow-hidden rounded-[4px] bg-bleu-pale">
                      {image ? (
                        <Image src={image} alt="" fill sizes="36px" className="object-cover" />
                      ) : (
                        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-bleu">
                          <Icon icon={Book02Icon} size={18} />
                        </span>
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm leading-5 font-medium text-encre" title={l.titre}>
                        {l.titre}
                      </span>
                      <span className="truncate text-xs leading-[18px] text-discret">
                        {l.statut === "publie" ? l.auteur || "Auteur non renseigné" : "N’est plus montré aux apprenants"}
                      </span>
                    </span>
                    {l.statut !== "publie" && (
                      <Tag tone={TON_ETAT_LIVRE[l.statut]} className="max-sm:hidden">
                        {ETATS_LIVRE[l.statut]}
                      </Tag>
                    )}
                    <span role="group" aria-label={`Actions de « ${l.titre} »`} className="flex flex-none items-center gap-0.5">
                      <IconButton
                        icon={ArrowUp01Icon}
                        label={`Monter « ${l.titre} »`}
                        variant="discret"
                        size="sm"
                        disabled={i === 0 || enCours}
                        onClick={() => agir(() => rangerLivreFormation(formationId, l.id, i))}
                      />
                      <IconButton
                        icon={ArrowDown01Icon}
                        label={`Descendre « ${l.titre} »`}
                        variant="discret"
                        size="sm"
                        disabled={i === recommandes.length - 1 || enCours}
                        onClick={() => agir(() => rangerLivreFormation(formationId, l.id, i + 2))}
                      />
                      <IconButton
                        icon={Delete02Icon}
                        label={`Retirer « ${l.titre} »`}
                        variant="discret"
                        size="sm"
                        disabled={enCours}
                        onClick={() => agir(() => retirerLivreFormation(formationId, l.id), "Livre retiré des recommandations")}
                      />
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          {publies.length === 0 ? (
            <p className="m-0 text-[13px] leading-5 text-discret">Publiez d’abord un livre dans la Bibliothèque pour le recommander ici.</p>
          ) : proposes.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Ajouter un livre publié" htmlFor={champ} className="min-w-0 flex-[1_1_260px]">
                <Select
                  id={champ}
                  placeholder="Choisir un livre"
                  options={proposes.map((l) => ({ value: l.id, label: l.auteur ? `${l.titre} · ${l.auteur}` : l.titre }))}
                  value={choisi}
                  onValueChange={setChoisi}
                />
              </Field>
              <Button
                type="button"
                className="h-12"
                loading={enCours}
                disabled={!choisi}
                onClick={() => agir(() => ajouterLivreFormation(formationId, choisi), "Livre recommandé", () => setChoisi(""))}
              >
                Ajouter
              </Button>
            </div>
          ) : (
            <p className="m-0 text-[13px] leading-5 text-discret">Tous les livres publiés sont déjà recommandés.</p>
          )}
        </>
      )}
    </section>
  );
}
