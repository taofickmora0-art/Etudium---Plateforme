import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Tag } from "@/components/ui/Tag";
import { noteLisible, type ChiffresFormateurs } from "@/lib/admin/cartes-chiffres";
import { compter } from "@/lib/admin/parcours-chiffres";
import type { FormateurAdmin } from "@/lib/admin/types";

// Les formateurs du back-office au style de l'espace étudiant (demande du 2 novembre 2026, option A) : une carte par
// fiche, avec ses initiales, son titre, ses formations, ses apprenants, sa note, ses corrections en attente, et si un
// compte y est relié (sans compte, le formateur ne peut pas se connecter à son espace).

const TITRES = /^(dr|pr|prof|m|mme|mlle)\.?$/i;
const initiales = (nom: string) =>
  nom
    .split(/\s+/)
    .filter((mot) => mot && !TITRES.test(mot))
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase())
    .join("") || "?";

function Chiffre({ valeur, texte }: { valeur?: string; texte: string }) {
  return (
    <span data-testid="chiffre-formateur" className="flex min-w-0 items-baseline gap-1 text-[13px] leading-6 text-discret">
      {valeur && <span className="text-base leading-6 font-semibold text-encre">{valeur}</span>}
      {valeur ? ` ${texte}` : texte}
    </span>
  );
}

export function GrilleFormateurs({ formateurs, chiffres }: { formateurs: FormateurAdmin[]; chiffres: ChiffresFormateurs | null }) {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-5 p-0">
      {formateurs.map((f) => {
        const c = chiffres?.parFormateur[f.id];
        const [nbFormations, ...motFormations] = c ? compter(c.formationsPubliees, "formation").split(" ") : [];
        const [nbApprenants, ...motApprenants] = c ? compter(c.apprenants, "apprenant").split(" ") : [];
        return (
          <li key={f.id} className="box-border flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar initials={initiales(f.nom)} size={44} />
              <div className="flex min-w-0 flex-col">
                <h2 className="m-0 truncate text-base leading-6 font-semibold text-encre">
                  <Link href={`/admin/formateurs/${f.id}`} className="focus-etudium text-inherit no-underline hover:underline">
                    {f.nom}
                  </Link>
                </h2>
                <p className={`m-0 truncate text-[13px] leading-5 ${f.titre ? "text-discret" : "text-indice"}`}>{f.titre || "Titre à compléter"}</p>
              </div>
            </div>
            {c && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <Chiffre valeur={nbFormations} texte={motFormations.join(" ")} />
                  <Chiffre valeur={nbApprenants} texte={motApprenants.join(" ")} />
                  {c.note !== null && c.avis > 0 ? <Chiffre valeur={noteLisible(c.note)} texte={`(${c.avis} avis)`} /> : <Chiffre texte="Pas d’avis" />}
                  <Chiffre valeur={String(c.aCorriger)} texte="à corriger" />
                </div>
                <div className="mt-auto">{c.compteRelie ? <Tag tone="valide">Compte relié</Tag> : <Tag tone="aCorriger">Sans compte</Tag>}</div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
