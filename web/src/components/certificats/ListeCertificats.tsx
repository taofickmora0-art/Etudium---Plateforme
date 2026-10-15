"use client";

import { useState } from "react";
import Link from "next/link";
import { Certificate01Icon, Download04Icon, Share01Icon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import type { Certificat, EnPreparation, PageCertificats } from "@/lib/certificats/types";
import { dateLongue } from "./dates";
import { PartagerCertificat } from "./PartagerCertificat";

const CARTE = "flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau p-5 max-sm:p-4";
const pluriel = (n: number, singulier: string, pluriel: string) => `${n} ${n > 1 ? pluriel : singulier}`;

/** « 1 leçon restante · 1 quiz à réussir · 2 exercices à valider ». */
function manque(f: EnPreparation): string {
  const lecons = f.total - f.terminees;
  return [
    // Aucune leçon publiée : la formation reste à 0 %, et le certificat ne peut pas encore être délivré.
    f.total === 0 && "Les leçons de cette formation ne sont pas encore publiées.",
    lecons > 0 && pluriel(lecons, "leçon restante", "leçons restantes"),
    f.quizRestants > 0 && `${f.quizRestants} quiz à réussir`,
    f.exercicesRestants > 0 && pluriel(f.exercicesRestants, "exercice à valider", "exercices à valider"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * La page « Certificats » (NdCertificats) : les certificats obtenus (Voir, Télécharger le PDF, Partager) et les
 * formations commencées « En préparation », avec ce qui manque et leur progression.
 */
export function ListeCertificats({ page }: { page: PageCertificats }) {
  const [partage, setPartage] = useState<Certificat | null>(null);
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section aria-label="Certificats obtenus" className="flex min-w-0 flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg leading-7 font-semibold text-encre">
          Certificats obtenus <Tag tone="compteur">{String(page.obtenus.length)}</Tag>
        </h2>
        {page.obtenus.length === 0 ? (
          <EmptyState icon={Certificate01Icon} title="Aucun certificat pour le moment" description="Terminez une formation : votre certificat s’affichera ici, prêt à télécharger et à partager." />
        ) : (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {page.obtenus.map((c) => (
              <article key={c.identifiant} className={CARTE}>
                <Tag tone="valide" className="self-start">
                  Obtenu
                </Tag>
                <h3 className="m-0 text-base leading-6 font-semibold text-encre">{c.formation}</h3>
                <p className="m-0 text-[13px] leading-5 text-discret">{`Obtenu le ${dateLongue(c.delivreLe)} · Vérifiable par QR Code`}</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={c.slug ? `/formations/${c.slug}/validation` : `/c/${c.identifiant}`} className={buttonVariants({ size: "sm" })}>
                    Voir
                  </Link>
                  <a href={`/certificats/${c.identifiant}/pdf`} className={buttonVariants({ variant: "contour", size: "sm" })}>
                    <Icon icon={Download04Icon} size={16} />
                    <span>Télécharger le PDF</span>
                  </a>
                  <Button variant="contour" size="sm" iconLeft={Share01Icon} onClick={() => setPartage(c)}>
                    Partager
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="En préparation" className="flex min-w-0 flex-col gap-3">
        <h2 className="m-0 flex items-center gap-2 text-lg leading-7 font-semibold text-encre">
          En préparation <Tag tone="compteur">{String(page.enPreparation.length)}</Tag>
        </h2>
        <p className="m-0 text-sm leading-[22px] text-discret">
          Le certificat reste verrouillé tant que toutes les conditions ne sont pas remplies : leçons terminées, quiz réussis et exercices validés.
        </p>
        {page.enPreparation.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-texte">Commencez une formation : elle s’affichera ici jusqu’à son certificat.</p>
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            {page.enPreparation.map((f) => {
              const pourcentage = f.total > 0 ? Math.round((100 * f.terminees) / f.total) : 0;
              return (
                <div key={f.formationId} className={CARTE}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link href={`/formations/${f.slug}/validation`} className="focus-etudium text-base leading-6 font-semibold text-encre no-underline hover:underline">
                      {f.titre}
                    </Link>
                    <span className="text-sm leading-5 font-medium text-titre">{`${pourcentage} %`}</span>
                  </div>
                  <ProgressBar value={pourcentage} label={`Progression : ${f.titre}`} />
                  {manque(f) && <p className="m-0 text-[13px] leading-5 text-discret">{manque(f)}</p>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {partage && <PartagerCertificat identifiant={partage.identifiant} formation={partage.formation} open onOpenChange={(ouvert) => !ouvert && setPartage(null)} />}
    </div>
  );
}
