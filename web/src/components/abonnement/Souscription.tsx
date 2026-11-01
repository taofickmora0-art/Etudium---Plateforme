"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckmarkCircle02Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Stepper } from "@/components/ui/Stepper";
import { Heading, Lead } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { essayerCode, payer, reessayer, suivrePaiement } from "@/lib/abonnement/actions";
import { dateLongue, dureeAbonnement, montantFcfa, periodeSouscription } from "@/lib/abonnement/regles";
import type { CodeFormule, EtapePaiement, EtatAbonnement, Formule, Operateur } from "@/lib/abonnement/types";
import { messageEchec, normaliserTelephone, operateurDuNumero } from "@/lib/paiements/regles";
import { AttentePaiement } from "./AttentePaiement";
import { phraseActif, ResultatPaiement } from "./ResultatPaiement";

// La souscription (lot 2, spec §6 ; NdAbonnement, NdMobPaiement) : l'abonnement, le paiement Mobile Money, la
// confirmation. Pendant l'attente, l'état est redemandé toutes les 3 secondes (le serveur le relit chez Payiz), pendant
// 3 minutes au plus.

const ETAPES = ["Abonnement", "Paiement", "Confirmation"];
const SUIVI_MS = 3000;
const OPERATEURS = [
  { value: "mtn", title: "MTN Mobile Money" },
  { value: "moov", title: "Moov Money" },
];
const CHAMP_NUMERO = "numero-mobile-money";
const CARTE = "rounded-carte border border-bordure-carte bg-panneau px-6 pt-[22px] pb-6 max-sm:px-4 max-sm:pt-4 max-sm:pb-5";

type CodeApplique = { code: string; remise: number; montant: number };

type Props = {
  formules: Formule[];
  abonnement: EtatAbonnement;
  /** L'équipe a activé les paiements et le serveur a sa configuration. */
  ouverts: boolean;
  /** L'abonnement choisi d'avance (`?formule=standard`). */
  initiale: CodeFormule | null;
  /** L'heure du serveur (ISO), pour les dates du récapitulatif. */
  maintenant: string;
};

export function Souscription({ formules, abonnement, ouverts, initiale, maintenant }: Props) {
  const proposees = formules.filter((f) => f.active);
  const choisissables = proposees.filter((f) => f.prix !== null);
  const parDefaut = choisissables.find((f) => f.code === initiale) ?? choisissables.find((f) => f.recommandee) ?? choisissables[0];

  const [etape, setEtape] = useState(0);
  const [formuleId, setFormuleId] = useState(parDefaut?.id ?? "");
  const [telephone, setTelephone] = useState("");
  const [operateur, setOperateur] = useState<Operateur | null>(null);
  const [operateurChoisi, setOperateurChoisi] = useState(false);
  const [saisieCode, setSaisieCode] = useState("");
  const [code, setCode] = useState<CodeApplique | null>(null);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [resultat, setResultat] = useState<Exclude<EtapePaiement, { etat: "erreur" }> | null>(null);
  const [ouverte, setOuverte] = useState(false);

  const formule = choisissables.find((f) => f.id === formuleId);
  const prix = formule?.prix ?? 0;
  const total = code ? code.montant : prix;
  const offert = code !== null && total === 0;
  const periode = formule ? periodeSouscription(new Date(maintenant), abonnement, formule.dureeMois) : null;

  function traiter(r: EtapePaiement) {
    if (r.etat === "erreur") {
      setErreur(r.message);
      setOuverte(false);
      return;
    }
    setErreur(null);
    setResultat(r);
    setOuverte(true);
    if (r.etat === "reussi") setEtape(2);
  }

  async function agir(action: () => Promise<EtapePaiement>) {
    setOccupe(true);
    try {
      traiter(await action());
    } finally {
      setOccupe(false);
    }
  }

  const lancer = () =>
    agir(() => payer({ formuleId, code: code?.code ?? "", telephone: offert ? "" : telephone, operateur: offert ? null : operateur }));
  const relancer = () => {
    const paiementId = resultat && resultat.etat !== "reussi" ? resultat.paiement.id : null;
    return paiementId ? agir(() => reessayer({ paiementId, telephone, operateur })) : lancer();
  };

  // Le suivi de l'attente : toutes les 3 s, jamais deux demandes à la fois ; à la fin des 3 minutes, l'échec « à temps ».
  useEffect(() => {
    if (!ouverte || resultat?.etat !== "attente") return;
    const { paiement, finAttente } = resultat;
    const fin = Date.parse(finAttente);
    let enVol = false;
    let fini = false;
    const minuterie = setInterval(async () => {
      if (enVol || fini) return;
      enVol = true;
      try {
        const r = await suivrePaiement(paiement.id);
        if (fini) return;
        if (r.etat !== "attente") {
          fini = true;
          traiter(r);
        } else if (Date.now() >= fin) {
          fini = true;
          traiter({ etat: "echoue", paiement: r.paiement, message: messageEchec("timeout") });
        }
      } finally {
        enVol = false;
      }
    }, SUIVI_MS);
    return () => {
      fini = true;
      clearInterval(minuterie);
    };
  }, [ouverte, resultat]);

  function changerNumero(valeur: string) {
    setTelephone(valeur);
    if (operateurChoisi) return;
    const normalise = normaliserTelephone(valeur);
    setOperateur(normalise ? operateurDuNumero(normalise) : null);
  }

  function changerFormule(id: string) {
    setFormuleId(id);
    setCode(null);
    setErreurCode(null);
  }

  async function appliquer() {
    const saisie = saisieCode.trim();
    if (!saisie) return;
    setErreurCode(null);
    const r = await essayerCode(formuleId, saisie);
    if (r.ok) setCode({ code: saisie, remise: r.remise, montant: r.montant });
    else {
      setCode(null);
      setErreurCode(r.message);
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      <Heading level="page">{abonnement.etat === "actif" ? "Prolonger mon abonnement" : "S’abonner"}</Heading>
      <Lead className="mt-2.5">
        Un abonnement de 3, 6 ou 12 mois ouvre toutes les formations, la communauté, les lives et leurs replays. Pas de prélèvement
        automatique.
      </Lead>
      <div aria-hidden="true" className="mt-5 h-px bg-separateur" />

      <section aria-label="Souscription" className={`mt-8 max-sm:mt-5 ${CARTE}`}>
        <Stepper steps={ETAPES} current={etape} label="Étapes de l’abonnement" />
        <div aria-hidden="true" className="mt-[18px] mb-[22px] h-px bg-bordure-carte max-sm:my-4" />

        {etape === 0 && (
          <div className="flex flex-col gap-4">
            <Heading level="section">1. Choisissez votre abonnement</Heading>
            {choisissables.length === 0 ? (
              <p className="m-0 text-sm leading-[22px] text-discret">Les prix seront annoncés au lancement.</p>
            ) : (
              <ChoiceCards
                label="Choisissez votre abonnement"
                className="gap-2.5 sm:grid-cols-1"
                value={formuleId}
                onValueChange={changerFormule}
                options={proposees.map((f) => ({
                  value: f.id,
                  title: f.nom,
                  subtitle: dureeAbonnement(f.dureeMois),
                  price: f.prix === null ? "Prix annoncés au lancement" : montantFcfa(f.prix),
                  badge: f.recommandee ? "Recommandé" : undefined,
                  disabled: f.prix === null,
                }))}
              />
            )}
            <p className="m-0 text-sm leading-[22px] text-discret">Un abonnement pris avant la fin du précédent s’ajoute à sa date de fin.</p>
            <div className="flex justify-end">
              <Button onClick={() => setEtape(1)} disabled={!formule}>
                Continuer
              </Button>
            </div>
          </div>
        )}

        {etape === 1 && formule && periode && (
          <div className="flex flex-col gap-[18px]">
            <Heading level="section">2. Paiement par Mobile Money</Heading>
            <div className="flex flex-wrap gap-6 max-sm:gap-4">
              <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-[18px] max-sm:gap-4">
                {!offert && (
                  <>
                    <Field label="Numéro Mobile Money" htmlFor={CHAMP_NUMERO} hint="Vous recevrez une demande de confirmation sur ce téléphone.">
                      <TextInput
                        id={CHAMP_NUMERO}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="01 00 00 00 00"
                        value={telephone}
                        onChange={(e) => changerNumero(e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-col gap-1.5">
                      <p className="m-0 text-sm leading-5 font-medium text-encre">Opérateur</p>
                      <ChoiceCards
                        label="Opérateur"
                        className="gap-2.5 sm:grid-cols-2"
                        value={operateur ?? ""}
                        onValueChange={(v) => {
                          setOperateur(v === "moov" ? "moov" : "mtn");
                          setOperateurChoisi(true);
                        }}
                        options={OPERATEURS}
                      />
                    </div>
                  </>
                )}
                {/* « Appliquer » est posé dans le champ (libellé 20 px + 6 px d'écart, puis 7 px dans le champ de 48 px). */}
                <div className="relative">
                  <Field
                    label="Code promo (facultatif)"
                    htmlFor="code-promo"
                    error={erreurCode ?? undefined}
                    hint={code ? `Code appliqué : − ${montantFcfa(code.remise)} sur ce paiement.` : undefined}
                  >
                    <TextInput
                      id="code-promo"
                      placeholder="Saisissez votre code"
                      autoCapitalize="characters"
                      className="pr-[110px]"
                      value={saisieCode}
                      onChange={(e) => setSaisieCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void appliquer();
                        }
                      }}
                    />
                  </Field>
                  <Button variant="gris" size="sm" className="absolute top-[33px] right-1.5" onClick={() => void appliquer()}>
                    Appliquer
                  </Button>
                </div>
              </div>

              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5 rounded-carte bg-page p-5 max-sm:p-4">
                <Heading level="card" as="h3">
                  Récapitulatif
                </Heading>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-sm leading-5 font-medium text-encre">Abonnement {formule.nom}</p>
                    <p className="m-0 text-[13px] leading-5 text-ardoise">{`${dureeAbonnement(formule.dureeMois)} · du ${dateLongue(periode.debut)} au ${dateLongue(periode.fin)}`}</p>
                  </div>
                  <p className="m-0 text-sm leading-5 font-medium whitespace-nowrap text-encre">{montantFcfa(prix)}</p>
                </div>
                {code && (
                  <div className="flex items-start justify-between gap-3">
                    <p className="m-0 text-sm leading-5 text-encre">Code promo ({code.code.toUpperCase()})</p>
                    <p className="m-0 text-sm leading-5 whitespace-nowrap text-encre">− {montantFcfa(code.remise)}</p>
                  </div>
                )}
                <div aria-hidden="true" className="h-px bg-filet" />
                <div className="flex items-baseline justify-between gap-3">
                  <p className="m-0 text-[15px] leading-[22px] font-semibold text-encre">Total</p>
                  <p className="m-0 text-lg leading-[26px] font-semibold whitespace-nowrap text-encre">{montantFcfa(total)}</p>
                </div>
              </div>
            </div>

            {!ouverts && !offert && <Banner tone="information" title="Les paiements ouvrent bientôt." />}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p className="m-0 flex flex-[1_1_240px] items-center gap-2 text-[13px] leading-5 text-discret">
                <Icon icon={SquareLock02Icon} size={16} />
                Paiement sécurisé par Payiz. Étudium ne voit jamais votre code secret.
              </p>
              <div className="flex gap-2 max-sm:w-full max-sm:flex-col-reverse">
                <Button variant="contour" onClick={() => setEtape(0)}>
                  Retour
                </Button>
                <Button onClick={() => void lancer()} loading={occupe} disabled={!offert && !ouverts}>
                  {offert ? "Activer mon abonnement offert" : `Payer ${montantFcfa(total)}`}
                </Button>
              </div>
            </div>
            {erreur && (
              <p role="alert" className="m-0 text-right text-sm leading-5 text-erreur-texte max-sm:text-left">
                {erreur}
              </p>
            )}
          </div>
        )}

        {etape === 2 && resultat?.etat === "reussi" && (
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex size-12 flex-none items-center justify-center rounded-bouton bg-reussite-fond text-reussite-texte">
              <Icon icon={CheckmarkCircle02Icon} size={22} />
            </span>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
              <Heading level="section">Paiement confirmé</Heading>
              <p className="m-0 text-sm leading-[22px] text-texte">{phraseActif(resultat.paiement)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {resultat.paiement.numeroRecu && (
                  <Button asChild variant="contour">
                    <Link href={`/abonnement/recus/${encodeURIComponent(resultat.paiement.numeroRecu)}`}>Voir le reçu</Link>
                  </Button>
                )}
                <Button asChild>
                  <Link href="/parcours">Commencer</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {ouverte && resultat?.etat === "attente" && (
        <AttentePaiement paiement={resultat.paiement} finAttente={resultat.finAttente} onFermer={() => setOuverte(false)} />
      )}
      {ouverte && resultat && resultat.etat !== "attente" && (
        <ResultatPaiement
          resultat={resultat}
          occupe={occupe}
          onFermer={() => setOuverte(false)}
          onReessayer={() => void relancer()}
          onRecommencer={() => void lancer()}
          champNumero={() => document.getElementById(CHAMP_NUMERO)}
        />
      )}
    </div>
  );
}
