import { AvisVides } from "@/components/catalogue/BlocsFiche";
import type { AvisFormation } from "@/lib/avis/types";
import { cn } from "@/lib/cn";
import { CarteAvis } from "./CarteAvis";
import { BoutonAvis } from "./FenetreAvis";
import { SyntheseAvis } from "./SyntheseAvis";

type Props = {
  variante: "public" | "connecte";
  formation: { id: string; titre: string };
  /** Null sans la migration 0010 : « Pas encore d’avis », sans bouton. */
  donnees: AvisFormation | null;
  /** Compte connecté à 50 % de progression au moins. */
  peutNoter: boolean;
};

const PHRASE = "Vous pourrez laisser un avis à partir de 50 % de progression.";

/**
 * « Avis des étudiants » (spec du lot 1, §7 ; annexe 1.3 §5.4 et §6 c). Fiche connectée : titre et bouton « Laisser un
 * avis » (« Modifier mon avis » s'il existe), ou la phrase des 50 %. Fiche publique : le contenu seul, sous le titre
 * posé par la fiche, avec la phrase.
 */
export function SectionAvis({ variante, formation, donnees, peutNoter }: Props) {
  const publique = variante === "public";
  const sien = donnees?.avis.find((a) => a.estMoi) ?? null;
  const bouton = !publique && donnees !== null && (sien !== null || peutNoter);
  const phrase = !bouton;
  const avecAvis = donnees !== null && donnees.avis.length > 0;

  const contenu = !avecAvis ? (
    <AvisVides variante={variante} phrase={phrase} />
  ) : (
    <div className={cn("flex flex-wrap items-start", publique ? "gap-14" : "gap-x-8 gap-y-5")}>
      {donnees.resume.total > 0 && (
        <div className={cn("min-w-0", publique ? "flex-[1_1_300px]" : "flex-[1_1_220px]")}>
          <SyntheseAvis resume={donnees.resume} variante={variante} />
        </div>
      )}
      <div className={cn("min-w-0", publique ? "flex-[999_1_420px]" : "flex-[2_1_300px]")}>
        <ul
          aria-label="Avis des étudiants"
          className={cn(
            "m-0 list-none p-0",
            publique ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(260px,calc((100%-16px)/2))),1fr))] gap-4" : "flex flex-col gap-3",
          )}
        >
          {donnees.avis.map((avis) => (
            <CarteAvis key={avis.id} avis={avis} variante={variante} />
          ))}
        </ul>
        {phrase && <p className="m-0 mt-3.5 text-[13px] leading-5 text-pretty text-discret">{PHRASE}</p>}
      </div>
    </div>
  );

  if (publique) return contenu;
  return (
    <section aria-labelledby="avis-titre" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="avis-titre" className="m-0 text-xl leading-7 font-semibold text-encre">
          Avis des étudiants
        </h2>
        {bouton && <BoutonAvis formation={formation} avis={sien} />}
      </div>
      {contenu}
    </section>
  );
}
