"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import Link from "next/link";
import { CheckmarkCircle02Icon, SmartPhone01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ChoiceCards } from "@/components/ui/ChoiceCards";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Select } from "@/components/ui/Select";
import { Heading, Lead } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { essayerCode, payer, reessayer, suivrePaiement } from "@/lib/abonnement/actions";
import { dateLongue, dureeAbonnement, montantDevise, montantFcfa, periodeSouscription } from "@/lib/abonnement/regles";
import type { CodeFormule, EtapePaiement, EtatAbonnement, Formule, MoyensDePaiement, Operateur, OperateurPaiement, PaysPaiement } from "@/lib/abonnement/types";
import { cn } from "@/lib/cn";
import { messageEchec, messageErreurPayiz, MOYENS_REPLI, normaliserTelephone, operateurDuNumero } from "@/lib/paiements/regles";
import { AttentePaiement } from "./AttentePaiement";
import { phraseActif, ResultatPaiement } from "./ResultatPaiement";

// La souscription (lot 2, spec §6 ; NdAbonnement, NdMobPaiement), sur un seul écran (demande du 1er novembre 2026) :
// les abonnements et le paiement Mobile Money se voient ensemble, puis la confirmation. Pendant l'attente, l'état est redemandé toutes les 3 secondes (le serveur le relit chez Payiz), pendant
// 3 minutes au plus. Depuis le 3 novembre 2026, le pays et les opérateurs viennent de Payiz : le Bénin par défaut,
// l'indicatif du pays devant le numéro, l'opérateur proposé d'après le numéro, et ce que le payeur paiera dans sa monnaie.

const SUIVI_MS = 3000;
const CHAMP_NUMERO = "numero-mobile-money";
const CHAMP_PAYS = "pays-mobile-money";
const INDICATIF = "indicatif-mobile-money";
const CARTE = "rounded-carte border border-bordure-carte bg-panneau px-6 pt-[22px] pb-6 max-sm:px-4 max-sm:pt-4 max-sm:pb-5";
const REPLI = "La liste des opérateurs n’a pas pu être chargée : seuls MTN et Moov, au Bénin, sont proposés pour le moment.";

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
  /** Le titre de la page ; sans lui quand la souscription est posée dans « Mon abonnement ». */
  enTete?: boolean;
  /** Les moyens de paiement de Payiz pour chaque prix (lus par le serveur) ; sans eux, le repli (Bénin, MTN, Moov). */
  moyens?: Record<number, MoyensDePaiement>;
};

/** Le Bénin s'il est proposé, sinon le premier pays. */
const paysParDefaut = (m: MoyensDePaiement): string => (m.pays.some((p) => p.code === "BEN") ? "BEN" : (m.pays[0]?.code ?? "BEN"));

/** L'opérateur proposé d'après le numéro saisi, s'il se lit dans ce pays. */
function operateurPropose(saisie: string, pays: PaysPaiement): Operateur | null {
  const numero = normaliserTelephone(saisie, pays);
  return numero ? operateurDuNumero(numero, pays) : null;
}

/** Le numéro, avec l'indicatif du pays devant (annoncé avec le champ). */
function ChampNumero({ indicatif, className, ...props }: ComponentPropsWithoutRef<"input"> & { indicatif: string }) {
  return (
    <div className="flex min-w-0">
      <span
        id={INDICATIF}
        className="box-border flex h-12 flex-none items-center rounded-l-champ border border-r-0 border-bordure-champ bg-page px-3.5 text-[15px] text-texte tabular-nums max-sm:px-3"
      >
        {indicatif}
      </span>
      <TextInput {...props} className={cn("min-w-0 rounded-l-none", className)} />
    </div>
  );
}

/** Le logo servi par Payiz, ou une pastille. */
function LogoOperateur({ logo }: { logo: string | null }) {
  if (!logo) {
    return (
      <span className="flex size-7 items-center justify-center rounded-md bg-bleu-pale text-bleu max-sm:size-6">
        <Icon icon={SmartPhone01Icon} size={16} />
      </span>
    );
  }
  // Une image de Payiz : l'optimisation d'images de Next ne s'y applique pas.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={logo} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" className="size-7 rounded-md object-contain max-sm:size-6" />;
}

/** Ce que le payeur paiera, si Payiz l'annonce et que ce n'est pas le prix en FCFA : « 321,50 GHS ». */
function aPayer(o: OperateurPaiement | undefined, total: number): string | null {
  if (!o || o.montantAPayer === null) return null;
  return o.devise !== "XOF" || o.montantAPayer !== total ? montantDevise(o.montantAPayer, o.devise) : null;
}

export function Souscription({ formules, abonnement, ouverts, initiale, maintenant, enTete = true, moyens: moyensParMontant }: Props) {
  const proposees = formules.filter((f) => f.active);
  const choisissables = proposees.filter((f) => f.prix !== null);
  const parDefaut = choisissables.find((f) => f.code === initiale) ?? choisissables.find((f) => f.recommandee) ?? choisissables[0];

  const [confirme, setConfirme] = useState(false);
  const [formuleId, setFormuleId] = useState(parDefaut?.id ?? "");
  const [telephone, setTelephone] = useState("");
  const [operateur, setOperateur] = useState<Operateur | null>(null);
  const [operateurChoisi, setOperateurChoisi] = useState(false);
  // `operator_required` : les opérateurs que Payiz propose pour ce numéro.
  const [candidats, setCandidats] = useState<Operateur[] | null>(null);
  const [saisieCode, setSaisieCode] = useState("");
  const [code, setCode] = useState<CodeApplique | null>(null);
  const [moyensCode, setMoyensCode] = useState<Record<number, MoyensDePaiement>>({});
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [resultat, setResultat] = useState<Exclude<EtapePaiement, { etat: "erreur" }> | null>(null);
  const [ouverte, setOuverte] = useState(false);
  // Ce que Payiz a annoncé au payeur au moment de payer (« 321,50 GHS »), repris dans l'attente.
  const [demande, setDemande] = useState<{ montant: number; texte: string } | null>(null);

  const formule = choisissables.find((f) => f.id === formuleId);
  const prix = formule?.prix ?? 0;
  const total = code ? code.montant : prix;
  const offert = code !== null && total === 0;
  const periode = formule ? periodeSouscription(new Date(maintenant), abonnement, formule.dureeMois) : null;

  // Les moyens pour le total (après un code promo, ceux qu'a rendus « Appliquer ») ; à défaut, la liste d'un autre
  // montant, sans les montants à payer qui ne valent pas pour celui-ci.
  const tousMoyens = { ...moyensParMontant, ...moyensCode };
  const exacts = tousMoyens[total];
  const moyens = exacts ?? tousMoyens[prix] ?? Object.values(tousMoyens)[0] ?? MOYENS_REPLI;
  const [codePays, setCodePays] = useState(() => paysParDefaut(moyens));
  const pays = moyens.pays.find((p) => p.code === codePays) ?? moyens.pays.find((p) => p.code === paysParDefaut(moyens)) ?? MOYENS_REPLI.pays[0];
  const restreints = candidats ? pays.operateurs.filter((o) => candidats.includes(o.code)) : [];
  const operateurs = restreints.length ? restreints : pays.operateurs;
  // Un seul opérateur possible : il est choisi d'office.
  const choisi = operateurs.find((o) => o.code === operateur) ?? (operateurs.length === 1 ? operateurs[0] : undefined);
  // Sans opérateur choisi, le montant vaut pour le pays si tous ses opérateurs annoncent le même.
  const unanime = pays.operateurs.every((o) => o.devise === pays.operateurs[0]?.devise && o.montantAPayer === pays.operateurs[0]?.montantAPayer);
  const montantAnnonce = exacts ? aPayer(choisi ?? (unanime ? pays.operateurs[0] : undefined), total) : null;
  const horsLimites =
    choisi?.devise === "XOF" && ((choisi.minimum !== null && total < choisi.minimum) || (choisi.maximum !== null && total > choisi.maximum));

  function traiter(r: EtapePaiement) {
    if (r.etat === "erreur") {
      setErreur(r.message);
      const candidatsPayiz = r.candidats;
      if (candidatsPayiz?.length) {
        setCandidats(candidatsPayiz);
        setOperateur((o) => (o && candidatsPayiz.includes(o) ? o : null));
      }
      setOuverte(false);
      return;
    }
    setErreur(null);
    setResultat(r);
    setOuverte(true);
    if (r.etat === "reussi") setConfirme(true);
  }

  async function agir(action: () => Promise<EtapePaiement>) {
    setOccupe(true);
    setDemande(montantAnnonce && !offert ? { montant: total, texte: montantAnnonce } : null);
    try {
      traiter(await action());
    } finally {
      setOccupe(false);
    }
  }

  const operateurEnvoye = choisi?.code ?? null;
  const lancer = () =>
    agir(() => payer({ formuleId, code: code?.code ?? "", telephone: offert ? "" : telephone, pays: pays.code, operateur: offert ? null : operateurEnvoye }));
  const relancer = () => {
    const paiementId = resultat && resultat.etat !== "reussi" ? resultat.paiement.id : null;
    return paiementId ? agir(() => reessayer({ paiementId, telephone, pays: pays.code, operateur: operateurEnvoye })) : lancer();
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
          traiter({ etat: "echoue", paiement: r.paiement, message: messageEchec("timeout"), incertain: true });
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
    setCandidats(null);
    if (operateurChoisi) return;
    setOperateur(operateurPropose(valeur, pays));
  }

  function changerPays(code: string) {
    const nouveau = moyens.pays.find((p) => p.code === code);
    if (!nouveau) return;
    setCodePays(code);
    setCandidats(null);
    setOperateurChoisi(false);
    setOperateur(operateurPropose(telephone, nouveau));
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
    if (r.ok) {
      setCode({ code: saisie, remise: r.remise, montant: r.montant });
      const pourCeMontant = r.moyens;
      if (pourCeMontant) setMoyensCode((avant) => ({ ...avant, [r.montant]: pourCeMontant }));
    } else {
      setCode(null);
      setErreurCode(r.message);
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      {enTete && (
        <>
          <Heading level="page">{abonnement.etat === "actif" ? "Prolonger mon abonnement" : "S’abonner"}</Heading>
          <Lead className="mt-2.5">
            Un abonnement de 3, 6 ou 12 mois ouvre toutes les formations, la communauté, les lives et leurs replays. Pas de
            prélèvement automatique.
          </Lead>
          <div aria-hidden="true" className="mt-5 h-px bg-separateur" />
        </>
      )}

      <section aria-label="Souscription" className={`${enTete ? "mt-8 max-sm:mt-5" : ""} ${CARTE}`}>
        {!confirme && (
          <div className="flex flex-col gap-4">
            <Heading level="section">Choisissez votre abonnement</Heading>
            {choisissables.length === 0 ? (
              <p className="m-0 text-sm leading-[22px] text-discret">Les prix seront annoncés au lancement.</p>
            ) : (
              <ChoiceCards
                label="Choisissez votre abonnement"
                className="gap-2.5"
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
            {abonnement.etat === "actif" && (
              <p className="m-0 text-sm leading-[22px] text-discret">Votre nouvel abonnement s’ajoute à la fin de celui en cours.</p>
            )}
          </div>
        )}

        {!confirme && formule && periode && (
          <div className="mt-7 flex flex-col gap-[18px] border-t border-bordure-carte pt-6 max-sm:mt-5 max-sm:pt-5">
            <Heading level="section">Paiement par Mobile Money</Heading>
            <div className="flex flex-wrap gap-6 max-sm:gap-4">
              <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-[18px] max-sm:gap-4">
                {!offert && (
                  <>
                    <Field label="Pays" htmlFor={CHAMP_PAYS}>
                      <Select
                        id={CHAMP_PAYS}
                        value={pays.code}
                        onChange={(e) => changerPays(e.target.value)}
                        options={moyens.pays.map((p) => ({ value: p.code, label: p.nom }))}
                      />
                    </Field>
                    <Field label="Numéro Mobile Money" htmlFor={CHAMP_NUMERO} hint="Vous recevrez une demande de confirmation sur ce téléphone.">
                      <ChampNumero
                        id={CHAMP_NUMERO}
                        indicatif={pays.indicatif}
                        aria-describedby={INDICATIF}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder={pays.code === "BEN" ? "01 00 00 00 00" : undefined}
                        value={telephone}
                        onChange={(e) => changerNumero(e.target.value)}
                      />
                    </Field>
                    <div className="flex flex-col gap-1.5">
                      <p className="m-0 text-sm leading-5 font-medium text-encre">Opérateur</p>
                      <ChoiceCards
                        label="Opérateur"
                        className="gap-2.5 sm:grid-cols-2"
                        value={choisi?.code ?? ""}
                        onValueChange={(v) => {
                          setOperateur(v);
                          setOperateurChoisi(true);
                        }}
                        options={operateurs.map((o) => ({ value: o.code, title: o.nom, visual: <LogoOperateur logo={o.logo} /> }))}
                      />
                      {horsLimites && <p className="m-0 text-[13px] leading-5 text-erreur-texte">{messageErreurPayiz("amount_out_of_range")}</p>}
                      {moyens.repli && ouverts && <p className="m-0 text-[13px] leading-5 text-discret">{REPLI}</p>}
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

              <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5 self-start rounded-carte bg-page p-5 max-sm:p-4">
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
                {montantAnnonce && !offert && <p className="m-0 text-[13px] leading-5 text-ardoise">{`Vous paierez ${montantAnnonce} (frais compris)`}</p>}
              </div>
            </div>

            {!ouverts && !offert && <Banner tone="information" title="Les paiements ouvrent bientôt." />}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <p className="m-0 flex flex-[1_1_240px] items-center gap-2 text-[13px] leading-5 text-discret">
                <Icon icon={SquareLock02Icon} size={16} />
                Paiement sécurisé par Payiz. Étudium ne voit jamais votre code secret.
              </p>
              <div className="flex gap-2 max-sm:w-full max-sm:flex-col-reverse">
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

        {confirme && resultat?.etat === "reussi" && (
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
        <AttentePaiement
          paiement={resultat.paiement}
          finAttente={resultat.finAttente}
          montant={demande && demande.montant === resultat.paiement.montant ? demande.texte : undefined}
          onFermer={() => setOuverte(false)}
        />
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
