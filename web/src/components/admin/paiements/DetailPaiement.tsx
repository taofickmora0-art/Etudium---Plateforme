"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { annulerAbonnement, chargerPaiement } from "@/lib/admin/paiements/actions";
import type { DetailPaiement as Detail } from "@/lib/admin/paiements/types";
import { dateLongue, dureeAbonnement, libelleMoyen, libelleStatut, montantFcfa } from "@/lib/abonnement/regles";
import { estSasPay, messageEchec, PREFIXE_SASPAY } from "@/lib/paiements/regles";

const MOTIF = "Indiquez le motif (3 à 300 caractères).";

function Ligne({ libelle, children }: { libelle: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-t border-bordure-carte py-2 first:border-t-0">
      <dt className="text-discret">{libelle}</dt>
      <dd className="m-0 text-right text-encre">{children}</dd>
    </div>
  );
}

/**
 * Le détail d'un paiement au back-office. Pour un paiement réussi dont l'abonnement court encore, un administrateur
 * peut l'annuler, avec un motif (remboursement exceptionnel fait depuis Payiz ; choix 4 de la spec).
 */
export function DetailPaiement({ id, ecriture, onFermer }: { id: string; ecriture: boolean; onFermer: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [annulation, setAnnulation] = useState(false);
  const [motif, setMotif] = useState("");
  const [erreurAnnulation, setErreurAnnulation] = useState(MOTIF);
  // L'heure d'ouverture de la fenêtre : un abonnement qui court encore peut être annulé.
  const [ouverture] = useState(() => Date.now());

  useEffect(() => {
    let actif = true;
    void chargerPaiement(id).then((r) => {
      if (!actif) return;
      if (r.ok) setDetail(r.detail);
      else setErreur(r.message);
    });
    return () => {
      actif = false;
    };
  }, [id]);

  const abonnement = detail?.abonnementEquipe ?? null;
  const annulable = ecriture && detail?.statut === "reussi" && abonnement && !abonnement.annuleLe && Date.parse(abonnement.fin) > ouverture;
  const statut = detail ? libelleStatut(detail.statut) : null;

  return (
    <>
      <Dialog
        open
        onOpenChange={(ouverte) => !ouverte && onFermer()}
        title={detail?.numeroRecu ? `Paiement ${detail.numeroRecu}` : "Paiement"}
        className="sm:max-w-[520px]"
        footer={
          detail && (
            <>
              {annulable && (
                <Button variant="dangerDoux" onClick={() => setAnnulation(true)}>
                  Annuler l’abonnement
                </Button>
              )}
              {detail.statut === "reussi" && detail.numeroRecu && (
                <Button asChild variant="contour">
                  <Link href={`/abonnement/recus/${encodeURIComponent(detail.numeroRecu)}`}>Voir le reçu</Link>
                </Button>
              )}
            </>
          )
        }
      >
        {erreur && (
          <p role="alert" className="m-0 mt-4 text-sm text-erreur-texte">
            {erreur}
          </p>
        )}
        {!detail && !erreur && <p className="m-0 mt-4 text-sm text-discret">Chargement…</p>}
        {detail && (
          <dl className="m-0 mt-4 flex flex-col text-sm leading-[22px]">
            {detail.compte && (
              <Ligne libelle="Compte">
                {`${detail.compte.prenom} ${detail.compte.nom}`.trim() || "Sans nom"}
                <br />
                <span className="text-discret">{detail.compte.email}</span>
              </Ligne>
            )}
            <Ligne libelle="Abonnement">{`${detail.formule.nom} · ${dureeAbonnement(detail.formule.dureeMois)}`}</Ligne>
            {abonnement && <Ligne libelle="Période">{`Du ${dateLongue(abonnement.debut)} au ${dateLongue(abonnement.fin)}`}</Ligne>}
            <Ligne libelle="Prix">{montantFcfa(detail.prixInitial)}</Ligne>
            {detail.remise > 0 && <Ligne libelle={detail.code ? `Remise (${detail.code})` : "Remise"}>{`− ${montantFcfa(detail.remise)}`}</Ligne>}
            <Ligne libelle="Montant">{montantFcfa(detail.montant)}</Ligne>
            <Ligne libelle="Statut">{statut && <Tag tone={statut.ton}>{statut.libelle}</Tag>}</Ligne>
            <Ligne libelle="Moyen">{`${libelleMoyen(detail)}${detail.telephoneMasque ? ` · ${detail.telephoneMasque}` : ""}`}</Ligne>
            {detail.statut === "echoue" && <Ligne libelle="Motif">{messageEchec(detail.motifEchec)}</Ligne>}
            <Ligne libelle="Créé le">{dateLongue(detail.creeLe)}</Ligne>
            {detail.confirmeLe && <Ligne libelle="Confirmé le">{dateLongue(detail.confirmeLe)}</Ligne>}
            {detail.payizId && <Ligne libelle="Encaissé par">{estSasPay(detail.payizId) ? "SasPay" : "Payiz"}</Ligne>}
            {detail.payizId && <Ligne libelle="Référence">{detail.payizId.replace(PREFIXE_SASPAY, "")}</Ligne>}
            {abonnement?.annuleLe && <Ligne libelle="Abonnement annulé">{`${dateLongue(abonnement.annuleLe)} · ${abonnement.motifAnnulation ?? ""}`}</Ligne>}
          </dl>
        )}
      </Dialog>
      {abonnement && (
        <ConfirmDialog
          open={annulation}
          onOpenChange={setAnnulation}
          title="Annuler cet abonnement ?"
          description="L’accès aux formations payantes se ferme aussitôt. Le compte est prévenu, avec le motif. Le remboursement se fait depuis Payiz."
          confirmLabel="Annuler l’abonnement"
          cancelLabel="Retour"
          tone="danger"
          errorMessage={erreurAnnulation}
          onConfirm={async () => {
            if (motif.trim().length < 3) {
              setErreurAnnulation(MOTIF);
              throw new Error(MOTIF);
            }
            const r = await annulerAbonnement(abonnement.id, motif.trim());
            if (!r.ok) {
              setErreurAnnulation(r.message);
              throw new Error(r.message);
            }
            onFermer();
            router.refresh();
          }}
        >
          <Field label="Motif" htmlFor="motif-annulation" hint="Il est envoyé au compte avec la notification.">
            <Textarea id="motif-annulation" value={motif} maxLength={300} onChange={(e) => setMotif(e.target.value)} />
          </Field>
        </ConfirmDialog>
      )}
    </>
  );
}
