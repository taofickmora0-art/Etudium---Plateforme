import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { CELLULE_TABLEAU, TableauListe } from "@/components/ui/TableauListe";
import { Tag } from "@/components/ui/Tag";
import { Heading } from "@/components/ui/Text";
import { dureeAbonnement, libelleMoyen, libelleStatut, montantFcfa } from "@/lib/abonnement/regles";
import type { CartePaiement } from "@/lib/abonnement/types";
import { dateNumerique } from "@/lib/utilisateurs/regles";

const COLONNES = ["Date", "Abonnement", "Moyen", "Montant", "Statut", "Reçu"];

/** L'historique des paiements de « Mon abonnement » (NdAbonnement, §3.5) : un reçu pour chaque paiement réussi. */
export function HistoriquePaiements({ paiements }: { paiements: CartePaiement[] }) {
  return (
    <section aria-labelledby="titre-historique" className="mt-3 flex flex-col gap-3.5">
      <div>
        <Heading level="section" as="h2" className="m-0">
          <span id="titre-historique">Historique des paiements</span>
        </Heading>
        <p className="m-0 mt-1 text-sm leading-[22px] text-discret">Chaque paiement réussi a son reçu.</p>
      </div>
      {paiements.length === 0 ? (
        <p className="m-0 text-sm leading-[22px] text-discret">Aucun paiement pour le moment.</p>
      ) : (
        <TableauListe nom="Paiements" nomCadre="Tableau des paiements" colonnes={COLONNES} largeurMin={640}>
          {paiements.map((p) => {
            const statut = libelleStatut(p.statut);
            const date = dateNumerique(p.creeLe);
            return (
              <tr key={p.id}>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{date}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{`${p.formule.nom} · ${dureeAbonnement(p.formule.dureeMois)}`}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{libelleMoyen(p)}</td>
                <td className={`${CELLULE_TABLEAU} whitespace-nowrap`}>{montantFcfa(p.montant)}</td>
                <td className={CELLULE_TABLEAU}>
                  <Tag tone={statut.ton}>{statut.libelle}</Tag>
                </td>
                <td className={CELLULE_TABLEAU}>
                  {p.statut === "reussi" && p.numeroRecu && (
                    <Link
                      href={`/abonnement/recus/${encodeURIComponent(p.numeroRecu)}`}
                      aria-label={`Voir le reçu du ${date}`}
                      className="focus-etudium inline-flex items-center gap-1 font-medium whitespace-nowrap text-bleu no-underline hover:underline"
                    >
                      Voir le reçu
                      <Icon icon={ArrowRight01Icon} size={16} />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </TableauListe>
      )}
    </section>
  );
}
