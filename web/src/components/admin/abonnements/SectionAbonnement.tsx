"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Section } from "@/components/admin/utilisateurs/Section";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { annulerAbonnement, resilierAbonnements } from "@/lib/admin/paiements/actions";
import type { AbonnementCompte, AbonnementsCompte } from "@/lib/admin/paiements/types";
import { dateLongue, dureeAbonnement, libelleMoyen } from "@/lib/abonnement/regles";
import type { EtatAbonnement, Formule } from "@/lib/abonnement/types";
import { FenetreAttribution } from "./FenetreAttribution";

const MOTIF = "Indiquez le motif (3 à 300 caractères).";

function libelleEtat(e: EtatAbonnement): string {
  if (e.etat === "actif") return `${e.formule.nom}, actif jusqu’au ${dateLongue(e.fin)}`;
  if (e.etat === "expire") return `${e.formule.nom}, expiré le ${dateLongue(e.fin)}`;
  return "Compte gratuit";
}

/** Un motif demandé dans une fenêtre de confirmation (résilier, annuler). */
function ChampMotif({ id, valeur, onChange }: { id: string; valeur: string; onChange: (v: string) => void }) {
  return (
    <Field label="Motif" htmlFor={id} hint="Il est envoyé à la personne avec la notification.">
      <Textarea id={id} value={valeur} maxLength={300} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

/**
 * La section « Abonnement » de la fiche d'un compte (0054) : son état et ses abonnements (origine, dates, reçu). Les
 * administrateurs attribuent un abonnement payé hors plateforme ou offert, résilient (tout l'accès s'arrête), ou
 * annulent un seul abonnement ; un modérateur voit sans boutons.
 */
export function SectionAbonnement({
  compte,
  donnees,
  formules,
  ecriture,
  maintenant,
}: {
  compte: { id: string; nom: string };
  donnees: AbonnementsCompte;
  formules: Formule[];
  ecriture: boolean;
  /** L'heure du serveur (ISO) : un abonnement qui court encore peut être annulé. */
  maintenant: string;
}) {
  const router = useRouter();
  const ouverture = Date.parse(maintenant);
  const [attribution, setAttribution] = useState(false);
  const [resiliation, setResiliation] = useState(false);
  const [aAnnuler, setAAnnuler] = useState<AbonnementCompte | null>(null);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState(MOTIF);
  const enCours = (a: AbonnementCompte) => !a.annuleLe && Date.parse(a.fin) > ouverture;
  const resiliable = donnees.abonnements.some(enCours);

  async function confirmer(action: () => Promise<{ ok: boolean; message?: string }>) {
    if (motif.trim().length < 3) {
      setErreur(MOTIF);
      throw new Error(MOTIF);
    }
    const r = await action();
    if (!r.ok) {
      setErreur(r.message ?? MOTIF);
      throw new Error(r.message);
    }
    setMotif("");
    router.refresh();
  }

  return (
    <Section titre="Abonnement">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[15px] leading-[22px] font-medium text-encre">{libelleEtat(donnees.etat)}</p>
        {ecriture && (
          <div className="flex flex-wrap gap-2">
            {resiliable && (
              <Button variant="dangerDoux" onClick={() => setResiliation(true)}>
                Résilier
              </Button>
            )}
            <Button onClick={() => setAttribution(true)}>Attribuer un abonnement</Button>
          </div>
        )}
      </div>

      {donnees.abonnements.length === 0 ? (
        <p className="m-0 text-sm leading-[22px] text-discret">Aucun abonnement pour le moment.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {donnees.abonnements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-bordure-carte py-3 first:border-t-0 first:pt-0">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 text-sm leading-[22px] font-medium text-encre">
                  {`${a.formule.nom} · ${dureeAbonnement(a.formule.dureeMois)}`}
                  {a.annuleLe && <Tag tone="echoue">Annulé</Tag>}
                </span>
                <span className="text-[13px] leading-5 text-discret">
                  {`Du ${dateLongue(a.debut)} au ${dateLongue(a.fin)} · ${libelleMoyen(a)}`}
                  {a.annuleLe && a.motifAnnulation ? ` · ${a.motifAnnulation}` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {a.numeroRecu && (
                  <Link
                    href={`/abonnement/recus/${encodeURIComponent(a.numeroRecu)}`}
                    aria-label={`Reçu ${a.numeroRecu}`}
                    className="focus-etudium text-[13px] leading-5 font-medium text-bleu no-underline hover:underline"
                  >
                    {a.numeroRecu}
                  </Link>
                )}
                {ecriture && enCours(a) && (
                  <Button variant="discret" size="sm" aria-label={`Annuler l’abonnement ${a.formule.nom}`} onClick={() => setAAnnuler(a)}>
                    Annuler
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {attribution && <FenetreAttribution compte={compte} formules={formules} onFermer={() => setAttribution(false)} />}
      <ConfirmDialog
        open={resiliation}
        onOpenChange={setResiliation}
        title={`Résilier l’abonnement de ${compte.nom} ?`}
        description="L’accès aux formations payantes s’arrête tout de suite : l’abonnement en cours et ceux qui suivent sont annulés. La personne est prévenue ; sa progression et ses certificats sont gardés."
        confirmLabel="Résilier"
        tone="danger"
        errorMessage={erreur}
        onConfirm={() => confirmer(() => resilierAbonnements(compte.id, motif))}
      >
        <ChampMotif id="motif-resiliation" valeur={motif} onChange={setMotif} />
      </ConfirmDialog>
      <ConfirmDialog
        open={aAnnuler !== null}
        onOpenChange={(ouverte) => !ouverte && setAAnnuler(null)}
        title="Annuler cet abonnement ?"
        description="Seul cet abonnement est annulé ; ceux qui le suivent avancent d’autant. La personne est prévenue."
        confirmLabel="Annuler l’abonnement"
        cancelLabel="Retour"
        tone="danger"
        errorMessage={erreur}
        onConfirm={() => confirmer(() => annulerAbonnement(aAnnuler?.id ?? "", motif))}
      >
        <ChampMotif id="motif-annulation-abonnement" valeur={motif} onChange={setMotif} />
      </ConfirmDialog>
    </Section>
  );
}
