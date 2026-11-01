import Link from "next/link";
import { CreditCardIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { Heading, Lead } from "@/components/ui/Text";
import { dateLongue, joursRestants } from "@/lib/abonnement/regles";
import type { CartePaiement, EtatAbonnement } from "@/lib/abonnement/types";
import { HistoriquePaiements } from "./HistoriquePaiements";

const SOUSCRIRE = "/abonnement/souscrire";

type Carte = { titre: string; pastille: { texte: string; ton: TagTone } | null; details: string[]; action: { texte: string; principale: boolean } };

/** « Expire dans 5 jours », « Expire demain », « Expire aujourd’hui ». */
const expireDans = (jours: number) => (jours <= 0 ? "Expire aujourd’hui" : jours === 1 ? "Expire demain" : `Expire dans ${jours} jours`);

function carteEtat(abonnement: EtatAbonnement, maintenant: Date): Carte {
  if (abonnement.etat === "gratuit") {
    return {
      titre: "Compte gratuit",
      pastille: null,
      details: ["Les formations gratuites, votre progression et vos certificats."],
      action: { texte: "S’abonner", principale: true },
    };
  }
  const titre = `Abonnement ${abonnement.formule.nom}`;
  if (abonnement.etat === "expire") {
    return { titre, pastille: { texte: "Expiré", ton: "echoue" }, details: [`Expiré le ${dateLongue(abonnement.fin)}`], action: { texte: "Renouveler", principale: true } };
  }
  const jours = joursRestants(abonnement.fin, maintenant);
  return {
    titre,
    pastille: jours <= 7 ? { texte: expireDans(jours), ton: "aCorriger" } : { texte: "Actif", ton: "reussi" },
    details: [`Jusqu’au ${dateLongue(abonnement.fin)}`, "Renouvellement manuel"],
    action: { texte: "Prolonger", principale: false },
  };
}

/** « Mon abonnement » (lot 2, spec §6 ; NdAbonnement) : l'état du compte, puis l'historique des paiements et leurs reçus. */
export function PageAbonnement({ abonnement, paiements, maintenant }: { abonnement: EtatAbonnement; paiements: CartePaiement[]; maintenant: Date }) {
  const carte = carteEtat(abonnement, maintenant);
  return (
    <div className="flex min-w-0 flex-col">
      <Heading level="page">Mon abonnement</Heading>
      <Lead className="mt-2.5">
        Un abonnement de 3, 6 ou 12 mois, payé par Mobile Money. Pas de prélèvement automatique : vous renouvelez quand vous le décidez.
      </Lead>
      <div aria-hidden="true" className="mt-5 h-px bg-separateur" />

      <div className="mt-8 flex flex-col gap-5 max-sm:mt-5">
        <section aria-label="Votre abonnement" className="flex flex-wrap items-center gap-x-4 gap-y-3.5 rounded-carte border border-bordure-carte px-[19px] py-[18px] max-sm:p-4">
          <span className="flex size-12 flex-none items-center justify-center rounded-bouton bg-bleu-pale text-bleu">
            <Icon icon={CreditCardIcon} size={22} />
          </span>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Heading level="card" as="h2">
                {carte.titre}
              </Heading>
              {carte.pastille && <Tag tone={carte.pastille.ton}>{carte.pastille.texte}</Tag>}
            </div>
            <ul className="m-0 flex list-none flex-wrap items-center gap-x-2.5 gap-y-1 p-0 text-sm leading-[22px] text-discret">
              {carte.details.map((d, i) => (
                <li key={d} className="flex items-center gap-2.5">
                  {i > 0 && <span aria-hidden="true" className="size-[3px] rounded-full bg-discret" />}
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant={carte.action.principale ? "principal" : "contour"} className="max-sm:w-full">
            <Link href={SOUSCRIRE}>{carte.action.texte}</Link>
          </Button>
        </section>

        <HistoriquePaiements paiements={paiements} />
      </div>
    </div>
  );
}
