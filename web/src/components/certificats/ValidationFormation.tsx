"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckmarkCircle02Icon, Clock01Icon, Download04Icon, Share01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { Banner } from "@/components/ui/Banner";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";
import { marquerCertificatVu } from "@/lib/certificats/actions";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import type { EtatValidation } from "@/lib/certificats/types";
import { LIBELLES_STATUT } from "@/lib/exercices/types";
import { PartagerCertificat } from "./PartagerCertificat";

const CARTE = "flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4";

/** « d’Aïcha », « d’Hervé », mais « de Kossi » : l'élision devant une voyelle ou un h seulement. */
const deNom = (nom: string) => (/^[aeiouyhàâäéèêëîïôöùûüÿœæ]/i.test(nom.trim()) ? `d’${nom}` : `de ${nom}`);

/** Une condition : remplie (coche verte) ou non (horloge), son libellé, son détail ; un lien vers ce qui manque. */
function Condition({ remplie, libelle, detail, lien }: { remplie: boolean; libelle: string; detail: string; lien?: string }) {
  const texte = lien && !remplie ? (
    <Link href={lien} className="focus-etudium text-encre underline-offset-2 hover:underline">
      {libelle}
    </Link>
  ) : (
    libelle
  );
  return (
    <li className="flex min-w-0 items-start gap-3 py-3">
      <span className={cn("mt-px flex flex-none", remplie ? "text-reussite-texte" : "text-discret")}>
        <Icon icon={remplie ? CheckmarkCircle02Icon : Clock01Icon} size={20} label={remplie ? "Condition remplie" : "Condition à remplir"} />
      </span>
      {/* Au téléphone, le détail passe sous le libellé (sinon il l'écraserait sur plusieurs lignes). */}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <span className="min-w-0 text-sm leading-[22px] font-medium text-encre">{texte}</span>
        <span className={cn("text-[13px] leading-5 sm:flex-none sm:text-right", remplie ? "text-reussite-texte" : "text-discret")}>{detail}</span>
      </span>
    </li>
  );
}

/**
 * « Validation de votre formation » (NdCertificat) : la progression, chaque condition (leçons, quiz, exercices) et, à
 * droite, le certificat s'il est délivré, avec « Télécharger le PDF », « Partager » et « Vérifier ». À la première visite
 * après la délivrance, la fenêtre « Félicitations » (NdCertificatObtenu).
 */
export function ValidationFormation({
  etat,
  formation,
  prenom,
  etapeSuivante = null,
}: {
  etat: EtatValidation;
  formation: { titre: string; slug: string };
  prenom: string;
  /** Une compétence validée : la première formation Business qui apprend à la vendre (0048 ; restructuration, §5.3). */
  etapeSuivante?: CarteCatalogue | null;
}) {
  const { certificat } = etat;
  const [felicitations, setFelicitations] = useState(Boolean(certificat && !certificat.vu));
  const [partage, setPartage] = useState(false);
  useEffect(() => {
    if (certificat && !certificat.vu) void marquerCertificatVu(certificat.identifiant);
  }, [certificat]);

  const { terminees, total } = etat.lecons;
  const pourcentage = total > 0 ? Math.round((100 * terminees) / total) : 0;
  const conditions: ReactNode[] = [
    <Condition key="lecons" remplie={total > 0 && terminees === total} libelle="Toutes les leçons terminées" detail={`${terminees} / ${total}`} />,
    ...etat.quiz.map((q) => (
      <Condition
        key={q.id}
        remplie={q.reussi}
        libelle={`Quiz « ${q.titre} » réussi`}
        detail={q.meilleur === null ? `Pas encore passé · minimum ${etat.minimum} %` : `${q.meilleur} % · minimum ${etat.minimum} %`}
        lien={adresseLecon(formation.slug, q.id)}
      />
    )),
    ...(etat.exercicesObligatoires
      ? etat.exercices.map((x) => (
          <Condition
            key={x.id}
            remplie={x.valide}
            libelle={`Exercice « ${x.titre} » validé`}
            detail={x.statut ? LIBELLES_STATUT[x.statut] : "À faire"}
            lien={adresseLecon(formation.slug, x.id)}
          />
        ))
      : []),
  ];

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        {certificat && <Banner tone="reussite" title="Félicitations !">Votre formation est validée. Votre certificat est prêt.</Banner>}
        <section aria-labelledby="conditions-validation" className={CARTE}>
          <h2 id="conditions-validation" className="m-0 text-lg leading-7 font-semibold text-encre max-sm:text-base">
            Conditions de validation
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm leading-[22px] font-medium text-discret">Progression du contenu</span>
              <span className="text-xl leading-7 font-medium text-titre">{`${pourcentage} %`}</span>
            </div>
            <ProgressBar value={pourcentage} label="Progression du contenu" />
          </div>
          <ul aria-label="Conditions de validation" className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-separateur">
            {conditions}
          </ul>
          {!etat.exercicesObligatoires && etat.exercices.length > 0 && (
            <p className="m-0 text-[13px] leading-5 text-discret">Les exercices sont facultatifs pour cette formation : ils ne comptent pas pour le certificat.</p>
          )}
        </section>
        {(etat.complet || certificat) && etapeSuivante && (
          <section aria-labelledby="etape-suivante" className={CARTE}>
            <div className="flex flex-col gap-1">
              <h2 id="etape-suivante" className="m-0 text-lg leading-7 font-semibold text-encre max-sm:text-base">
                Étape suivante
              </h2>
              <p className="m-0 text-sm leading-[22px] text-discret">Vous maîtrisez cette compétence : apprenez maintenant à la vendre.</p>
            </div>
            <p className="m-0 text-[15px] leading-[22px] font-semibold text-encre">{etapeSuivante.titre}</p>
            <Button asChild className="self-start max-sm:w-full">
              <Link href={`/formations/${etapeSuivante.slug}`}>Voir la formation</Link>
            </Button>
          </section>
        )}
      </div>

      <section aria-labelledby="votre-certificat" className={CARTE}>
        <h2 id="votre-certificat" className="m-0 text-lg leading-7 font-semibold text-encre max-sm:text-base">
          Votre certificat
        </h2>
        {certificat ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- image générée à la demande, privée, sans optimisation */}
            <img
              src={`/certificats/${certificat.identifiant}/image`}
              alt={`Certificat de réussite ${deNom(certificat.titulaire)} pour la formation ${certificat.formation}`}
              width={1754}
              height={1240}
              className="h-auto w-full rounded-champ border border-bordure-carte"
            />
            <div className="flex flex-wrap gap-2">
              <a href={`/certificats/${certificat.identifiant}/pdf`} className={buttonVariants()}>
                <Icon icon={Download04Icon} size={18} />
                <span>Télécharger le PDF</span>
              </a>
              <Button variant="contour" iconLeft={Share01Icon} onClick={() => setPartage(true)}>
                Partager
              </Button>
              <Link href={`/c/${certificat.identifiant}`} className={buttonVariants({ variant: "discret" })}>
                Vérifier
              </Link>
            </div>
            <p className="m-0 text-xs leading-[18px] text-discret">{`N° ${certificat.identifiant}`}</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-champ bg-page px-4 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-bouton bg-coque text-discret">
              <Icon icon={SquareLock02Icon} size={22} />
            </span>
            <p className="m-0 max-w-[320px] text-sm leading-[22px] text-texte">Votre certificat sera délivré dès que toutes les conditions seront remplies.</p>
          </div>
        )}
      </section>

      {certificat && (
        <>
          <Dialog
            open={felicitations}
            onOpenChange={setFelicitations}
            title={`Félicitations, ${prenom || "à vous"} !`}
            description={`Vous avez validé « ${formation.titre} ». Votre certificat est prêt, avec son QR Code de vérification.`}
            icon={CheckmarkCircle02Icon}
            iconTone="reussite"
            footer={
              <>
                <Button
                  variant="contour"
                  onClick={() => {
                    setFelicitations(false);
                    setPartage(true);
                  }}
                >
                  Partager
                </Button>
                <Button onClick={() => setFelicitations(false)}>Voir mon certificat</Button>
              </>
            }
          />
          <PartagerCertificat identifiant={certificat.identifiant} formation={certificat.formation} open={partage} onOpenChange={setPartage} />
        </>
      )}
    </div>
  );
}
