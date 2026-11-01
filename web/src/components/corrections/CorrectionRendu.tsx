"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { aUnContenuEcrit, ContenuEcrit } from "@/components/lecon/ContenuEcrit";
import { HistoriqueRendus, TONS_STATUT } from "@/components/exercices/HistoriqueRendus";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tag } from "@/components/ui/Tag";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { tailleLisible } from "@/lib/admin/fichiers";
import { moment } from "@/lib/communaute/regles";
import { corrigerRendu, lienRendu } from "@/lib/exercices/actions";
import { LIBELLES_STATUT, type RenduACorriger } from "@/lib/exercices/types";

const CARTE = "flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4";
const REMARQUE_EXIGEE = "Expliquez ce qu’il faut corriger.";
const ECHEC = "La correction n’a pas pu être enregistrée. Réessayez.";
const FICHIER_ECHEC = "Le fichier n’a pas pu être ouvert. Réessayez.";

/**
 * Corriger un travail (NdCorrection) : le travail rendu (fichier, message de l'étudiant), « Votre retour » (remarque, puis
 * « Demander une correction » ou « Valider l'exercice »), la consigne et l'historique. Les cases « Points de la consigne »
 * du design ne sont pas reprises (spec §3) ; rien ne se débloque après une validation.
 */
export function CorrectionRendu({ rendu }: { rendu: RenduACorriger }) {
  const id = useId();
  const router = useRouter();
  const { toast } = useToast();
  const [remarque, setRemarque] = useState("");
  const [erreurRemarque, setErreurRemarque] = useState<string | null>(null);
  const [decision, setDecision] = useState<"valide" | "a_corriger" | null>(null);
  const [erreurEnvoi, setErreurEnvoi] = useState<string>();
  const { version } = rendu;
  const aCorriger = version.statut === "en_attente" && rendu.derniere;
  const maintenant = new Date();
  const champ = useRef<HTMLTextAreaElement>(null);
  // Corrigé, la page relue : les boutons disparaissent, le focus passe au titre « Votre retour ».
  const titreRetour = useRef<HTMLHeadingElement>(null);
  const statutVu = useRef(version.statut);
  useEffect(() => {
    if (version.statut !== statutVu.current) titreRetour.current?.focus();
    statutVu.current = version.statut;
  }, [version.statut]);

  async function telecharger() {
    const reponse = await lienRendu(version.id).catch(() => ({ erreur: FICHIER_ECHEC }));
    if ("url" in reponse) window.location.assign(reponse.url);
    else toast({ tone: "erreur", title: reponse.erreur });
  }

  function ouvrir(choix: "valide" | "a_corriger") {
    if (choix === "a_corriger" && !remarque.trim()) {
      setErreurRemarque(REMARQUE_EXIGEE);
      champ.current?.focus();
      return;
    }
    setErreurRemarque(null);
    setErreurEnvoi(undefined);
    setDecision(choix);
  }

  async function confirmer() {
    if (!decision) return;
    const reponse = await corrigerRendu(version.id, decision, remarque.trim()).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!reponse.ok) {
      setErreurEnvoi(reponse.message);
      throw new Error(reponse.message);
    }
    toast(
      decision === "valide"
        ? { tone: "reussite", title: "Exercice validé", description: "L’étudiant est prévenu." }
        : { tone: "reussite", title: "Remarque envoyée", description: "L’étudiant pourra déposer une nouvelle version de son travail." },
    );
    setRemarque("");
    router.refresh();
  }

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby={`${id}-travail`} className={CARTE}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`${id}-travail`} className="m-0 text-lg leading-7 font-semibold text-encre max-sm:text-base">
              Travail rendu
            </h2>
            <Tag tone={TONS_STATUT[version.statut]}>{LIBELLES_STATUT[version.statut]}</Tag>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] leading-[22px] font-semibold text-encre">{rendu.etudiant}</span>
            <span className="text-[13px] leading-5 text-discret">{`Version ${version.version}, déposée ${moment(version.creeLe, maintenant)}`}</span>
          </div>
          {version.aUnFichier && (
            <div className="flex min-w-0 items-center gap-3 rounded-bouton border border-bordure-carte px-3.5 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-5 font-medium text-encre">{version.nomFichier}</span>
                <span className="text-xs leading-[18px] text-discret">{tailleLisible(version.tailleOctets)}</span>
              </span>
              <Button variant="contour" size="sm" iconLeft={Download04Icon} aria-label={`Télécharger ${version.nomFichier}`} onClick={() => void telecharger()}>
                Télécharger
              </Button>
            </div>
          )}
          {version.message && (
            <div className="flex flex-col gap-1">
              <span className="text-sm leading-5 font-medium text-encre">Message de l’étudiant</span>
              <p className="m-0 text-sm leading-[22px] text-texte">{version.message}</p>
            </div>
          )}
        </section>

        <section aria-labelledby={`${id}-retour`} className={CARTE}>
          <h2 ref={titreRetour} tabIndex={-1} id={`${id}-retour`} className="m-0 text-lg leading-7 font-semibold text-encre outline-none max-sm:text-base">
            Votre retour
          </h2>
          {!rendu.derniere ? (
            <Banner tone="information" title="Une version plus récente de ce travail existe." />
          ) : !aCorriger ? (
            <Banner tone="information" title="Ce travail a déjà été corrigé." />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-remarque`} className="text-sm leading-5 font-medium text-encre">
                  Remarque pour l’étudiant
                </label>
                <Textarea
                  ref={champ}
                  id={`${id}-remarque`}
                  aria-invalid={erreurRemarque ? true : undefined}
                  rows={4}
                  maxLength={2000}
                  placeholder="Expliquez ce qu’il faut améliorer, ou un mot d’encouragement…"
                  value={remarque}
                  onChange={(e) => {
                    setRemarque(e.target.value);
                    setErreurRemarque(null);
                  }}
                  aria-describedby={`${id}-aide`}
                />
                {erreurRemarque ? (
                  <p id={`${id}-aide`} role="alert" className="m-0 text-xs leading-[18px] text-erreur-texte">
                    {erreurRemarque}
                  </p>
                ) : (
                  <p id={`${id}-aide`} className="m-0 text-xs leading-[18px] text-discret">
                    Visible par l’étudiant et par les correcteurs de la formation. Exigée pour demander une correction, facultative pour valider.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="contour" onClick={() => ouvrir("a_corriger")} className="max-sm:flex-1">
                  Demander une correction
                </Button>
                <Button onClick={() => ouvrir("valide")} className="max-sm:flex-1">
                  Valider l’exercice
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Consigne" className={CARTE}>
          <h2 className="m-0 text-base leading-6 font-semibold text-encre">Consigne</h2>
          {aUnContenuEcrit({ document: rendu.exercice.consigneDocument, texte: rendu.exercice.consigne }) ? (
            <ContenuEcrit
              document={rendu.exercice.consigneDocument}
              images={rendu.images}
              texte={rendu.exercice.consigne}
              className="text-sm leading-[22px] text-texte"
            />
          ) : (
            <p className="m-0 text-sm leading-[22px] text-discret">Pas de consigne écrite.</p>
          )}
        </section>
        <div className={CARTE}>
          <HistoriqueRendus versions={rendu.historique} vue="correcteur" />
        </div>
      </div>

      <ConfirmDialog
        open={decision !== null}
        onOpenChange={(ouvert) => !ouvert && setDecision(null)}
        title={decision === "valide" ? "Valider cet exercice ?" : "Demander une correction ?"}
        description={decision === "valide" ? "L’étudiant sera prévenu." : "L’étudiant pourra déposer une nouvelle version de son travail."}
        confirmLabel={decision === "valide" ? "Valider l’exercice" : "Envoyer la demande"}
        errorMessage={erreurEnvoi}
        onConfirm={confirmer}
      />
    </div>
  );
}
