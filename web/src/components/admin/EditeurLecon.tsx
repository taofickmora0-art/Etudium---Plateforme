"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, InformationCircleIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { LecteurVideo } from "@/components/lecon/LecteurVideo";
import { SondeDureeVideo } from "./SondeDureeVideo";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { changerStatutLecon, saveLecon } from "@/lib/admin/actions";
import { baseFormations } from "@/lib/admin/espace";
import type { LeconAdmin } from "@/lib/admin/types";
import { parseVideoUrl, videoLabel, videoLink } from "@/lib/admin/video";
import { RessourcesEditor } from "./RessourcesEditor";
import { StatutLecon } from "./StatutLecon";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

// L'éditeur visuel (Tiptap) de la communauté, chargé à part : le texte de la leçon a la même mise en forme.
const EditeurTexte = dynamic(() => import("@/components/communaute/EditeurTexte").then((m) => m.EditeurTexte), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[220px] animate-pulse rounded-champ border border-bordure-champ bg-page" />,
});

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const DUREE_ENTIERE = "Minutes et secondes : des nombres entiers (secondes de 0 à 59).";
// Des chiffres seulement : « 12.40 » dans les minutes serait lu « 12:4:00 » (12 h 04) et la leçon ne se terminerait plus.
const ENTIER = /^\d*$/;
/** « 7:42 », « 75:00 » : la forme des champs de durée. */
const minutesSecondes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/** Un écart de quelques secondes ne gêne pas la validation. */
const TOLERANCE_S = 2;

/** Ce que l'on sait du lien pendant la frappe : reconnu (fournisseur · identifiant) ou non. */
function aideVideo(lien: string) {
  if (!lien.trim()) return "YouTube ou Vimeo, par exemple https://youtu.be/…";
  const video = parseVideoUrl(lien);
  return video ? `Reconnu : ${videoLabel(video)}` : "Lien non reconnu : collez un lien YouTube ou Vimeo.";
}

type EditeurLeconProps = {
  lecon: LeconAdmin;
  /** Adresse de base des formations : le back-office, ou l'espace formateur. */
  base?: "/admin/formations" | "/formateur/formations";
};

/**
 * L'éditeur d'une leçon (refonte des formations, spec §3.4, d'après izimentor) : une barre en haut (retour aux leçons,
 * « Leçon 2 sur 5 · Module 1 », ‹ ›, statut, Enregistrer, Voir comme un étudiant) ; à gauche les réglages (vidéo et son
 * aperçu, durée, commentaires, aperçu gratuit, documents) ; à droite le titre et le texte mis en forme, puis « Dans cette
 * leçon ». Quitter avec des changements non enregistrés demande confirmation.
 */
export function EditeurLecon({ lecon, base = "/admin/formations" }: EditeurLeconProps) {
  const id = useId();
  const formulaire = `${id}-lecon`;
  const router = useRouter();
  const { toast } = useToast();
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(saveLecon, { succes: "La leçon a bien été mise à jour." });
  const espace = base === "/formateur/formations" ? "formateur" : "admin";
  const racine = `${baseFormations(espace)}/${lecon.formationId}`;
  const retour = `${racine}?onglet=programme`;
  const versLecon = (leconId: string) => `${racine}/lecons/${leconId}`;

  const [lien, setLien] = useState(() => valeur("video", lecon.video ? videoLink(lecon.video) : ""));
  const [minutes, setMinutes] = useState(String(Math.floor(lecon.dureeSecondes / 60)));
  const [secondes, setSecondes] = useState(String(lecon.dureeSecondes % 60));
  const [texte, setTexte] = useState(() => valeur("texte", lecon.texte));
  const [publiee, setPubliee] = useState(lecon.publiee);
  const [details, setDetails] = useState(false);
  const [modifie, setModifie] = useState(false);
  const [depart, setDepart] = useState<string | null>(null);
  const [erreurDuree, setErreurDuree] = useState<string | null>(null);
  // La vraie durée, lue sur la vidéo par le lecteur officiel ; null tant qu'elle est inconnue.
  const [dureeVideo, setDureeVideo] = useState<number | null>(null);
  // Le lecteur officiel n'a pas livré la durée (réseau, bloqueur) : la saisie reste à la main.
  const [sondeMuette, setSondeMuette] = useState(false);
  // Un lien collé ou tapé : la durée de cette vidéo remplacera celle saisie.
  const lienChange = useRef(false);
  const video = parseVideoUrl(lien);
  // Envoyée au format « 12:40 » (une durée de plus d'une heure s'écrit « 75:00 »).
  const duree = `${Number(minutes) || 0}:${String(Number(secondes) || 0).padStart(2, "0")}`;
  const changer = () => setModifie(true);
  const saisie = (Number(minutes) || 0) * 60 + (Number(secondes) || 0);
  const ecart = dureeVideo !== null && saisie > 0 && Math.abs(saisie - dureeVideo) > TOLERANCE_S;
  const reprendre = (s: number) => {
    setMinutes(String(Math.floor(s / 60)));
    setSecondes(String(s % 60));
    changer();
  };
  // Un nouveau lien, ou rien de saisi : la durée exacte de la vidéo est reprise. Une leçon déjà enregistrée garde la
  // sienne, et un écart est signalé (« Utiliser 7:42 ») : rien ne change sans qu'on le voie.
  const dureeLue = (s: number) => {
    setDureeVideo(s);
    if (saisie === 0 || lienChange.current) reprendre(s);
    lienChange.current = false;
  };
  const dureeValide = ENTIER.test(minutes.trim()) && ENTIER.test(secondes.trim()) && (Number(secondes) || 0) < 60;
  // Une erreur dans « Dans cette leçon » : la section s'ouvre pour la montrer.
  const deplie = details || Boolean(e.resume || e.points_cles || e.titre_court);
  const soumettre = (evenement: FormEvent<HTMLFormElement>) => {
    if (!dureeValide) {
      evenement.preventDefault();
      setErreurDuree(DUREE_ENTIERE);
      return;
    }
    setErreurDuree(null);
    envoyer(evenement);
  };

  // Enregistré : plus rien à perdre.
  const [etatVu, setEtatVu] = useState(state);
  if (state !== etatVu) {
    setEtatVu(state);
    if (state.status === "success") setModifie(false);
  }
  // Fermer l'onglet ou recharger avec des changements : le navigateur demande confirmation.
  useEffect(() => {
    if (!modifie) return;
    const retenir = (evenement: BeforeUnloadEvent) => {
      evenement.preventDefault();
      evenement.returnValue = "";
    };
    window.addEventListener("beforeunload", retenir);
    // Tout autre lien de la page (menu, logo…) : la même question que « Retour aux leçons ».
    const intercepter = (evenement: globalThis.MouseEvent) => {
      if (evenement.defaultPrevented || evenement.button !== 0 || evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
      const lien = evenement.target instanceof Element ? evenement.target.closest("a[href]") : null;
      if (!(lien instanceof HTMLAnchorElement) || lien.target === "_blank" || lien.hasAttribute("download")) return;
      const href = lien.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;
      evenement.preventDefault();
      setDepart(href);
    };
    document.addEventListener("click", intercepter, true);
    return () => {
      window.removeEventListener("beforeunload", retenir);
      document.removeEventListener("click", intercepter, true);
    };
  }, [modifie]);

  /** Un lien qui quitte la leçon : avec des changements non enregistrés, on demande d'abord. */
  const partir = (href: string) => (evenement: MouseEvent<HTMLAnchorElement>) => {
    if (!modifie) return;
    evenement.preventDefault();
    setDepart(href);
  };

  async function changerStatut(suivant: boolean) {
    setPubliee(suivant);
    const reponse = await changerStatutLecon(lecon.id, suivant).catch(() => ({ ok: false, message: ECHEC }));
    if (!reponse.ok) {
      setPubliee(!suivant);
      toast({ tone: "erreur", title: reponse.message ?? ECHEC });
    } else {
      toast({ tone: "reussite", title: suivant ? "Leçon publiée" : "Leçon remise en brouillon" });
    }
  }

  const { position, voisines } = lecon;
  const fleche = "focus-etudium " + iconButtonVariants({ variant: "discret", size: "sm" });

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* La barre du haut, qui reste visible pendant qu'on écrit. */}
      <div className="sticky top-[60px] z-20 -mx-1 sm:top-[73px] lg:top-0 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-bordure-carte bg-page/95 px-1 py-3 backdrop-blur max-sm:gap-y-1.5 max-sm:py-2">
        <Link href={retour} onClick={partir(retour)} className="focus-etudium inline-flex min-w-0 items-center gap-1.5 rounded-puce text-[15px] leading-[22px] font-medium text-encre no-underline hover:underline max-sm:text-sm">
          <Icon icon={ArrowLeft01Icon} size={18} className="flex-none" />
          <span className="truncate">
            Retour aux leçons <span className="text-discret">({lecon.formationTitre})</span>
          </span>
        </Link>
        <span className="ml-auto flex min-w-0 flex-wrap items-center gap-2 max-sm:ml-0 max-sm:w-full">
          {/* Sur téléphone, la position (tronquée) et les flèches tiennent sur une ligne. */}
          <span className="flex min-w-0 items-center gap-2 max-sm:w-full">
            <span className="min-w-0 text-[13px] leading-5 text-discret max-sm:flex-1 max-sm:truncate max-sm:text-xs">{`Leçon ${position.rang} sur ${position.total} · Module ${position.module.rang} : ${position.module.titre}`}</span>
            <span className="flex flex-none items-center gap-1">
              {voisines.precedente && (
                <Link href={versLecon(voisines.precedente)} onClick={partir(versLecon(voisines.precedente))} aria-label="Leçon précédente" className={fleche}>
                  <Icon icon={ArrowLeft01Icon} size={16} />
                </Link>
              )}
              {voisines.suivante && (
                <Link href={versLecon(voisines.suivante)} onClick={partir(versLecon(voisines.suivante))} aria-label="Leçon suivante" className={fleche}>
                  <Icon icon={ArrowRight01Icon} size={16} />
                </Link>
              )}
            </span>
          </span>
          <span className="flex items-center gap-2 max-sm:ml-auto">
            <StatutLecon publiee={publiee} onChange={(suivant) => void changerStatut(suivant)} />
            <Button type="submit" form={formulaire} size="sm" loading={pending}>
              Enregistrer
            </Button>
            {/* Dans un autre onglet : l'éditeur reste ouvert, rien n'est perdu. */}
            <a
              href={`/formations/${lecon.formationSlug}/lecons/${lecon.id}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Voir comme un étudiant"
              title="Voir comme un étudiant"
              className={"focus-etudium " + iconButtonVariants({ variant: "discret", size: "sm" })}
            >
              <Icon icon={ViewIcon} size={18} />
            </a>
          </span>
        </span>
      </div>

      {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        {/* Les réglages : leurs champs appartiennent au formulaire de la leçon (attribut form) ; les documents ont les leurs. */}
        <section aria-label="Réglages" className="flex min-w-0 flex-col gap-5 rounded-carte border border-bordure-carte bg-bleu-clair/60 p-5 max-sm:gap-4 max-sm:p-4 lg:sticky lg:top-[72px]">
          <h2 className="m-0 text-[15px] leading-[22px] font-semibold text-encre">Réglages</h2>
          <div className="flex flex-col gap-2.5">
            <Field label="Lien de la vidéo" htmlFor={`${id}-video`} hint={aideVideo(lien)} error={e.video}>
              <TextInput
                id={`${id}-video`}
                form={formulaire}
                name="video"
                type="url"
                inputMode="url"
                value={lien}
                onChange={(evenement) => {
                  setLien(evenement.target.value);
                  setDureeVideo(null);
                  setSondeMuette(false);
                  lienChange.current = true;
                  changer();
                }}
                autoCapitalize="none"
                spellCheck={false}
              />
            </Field>
            {video && <LecteurVideo video={video} titre={lecon.titre} />}
            {video && <SondeDureeVideo key={`${video.fournisseur}:${video.id}`} video={video} onDuree={dureeLue} onEchec={() => setSondeMuette(true)} />}
          </div>
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm leading-5 font-semibold text-encre">Durée de la vidéo</legend>
            <div className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-discret">
                <TextInput
                  type="number"
                  min={0}
                  aria-label="Minutes"
                  step={1}
                  inputMode="numeric"
                  value={minutes}
                  onChange={(evenement) => {
                    setMinutes(evenement.target.value);
                    changer();
                  }}
                  className="h-10 min-w-0"
                />
                min
              </label>
              <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-discret">
                <TextInput
                  type="number"
                  min={0}
                  max={59}
                  aria-label="Secondes"
                  step={1}
                  inputMode="numeric"
                  value={secondes}
                  onChange={(evenement) => {
                    setSecondes(evenement.target.value);
                    changer();
                  }}
                  className="h-10 min-w-0"
                />
                s
              </label>
            </div>
            <input type="hidden" form={formulaire} name="duree" value={duree} />
            {(erreurDuree ?? e.duree) && (
              <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
                {erreurDuree ?? e.duree}
              </p>
            )}
            {ecart && dureeVideo !== null && (
              <div role="status" className="flex flex-col items-start gap-2 rounded-champ bg-attention-fond px-3 py-2.5 text-[13px] leading-5 text-attention-texte">
                <p className="m-0 font-medium">{`La vidéo dure ${minutesSecondes(dureeVideo)} ; la durée saisie est ${minutesSecondes(saisie)}.`}</p>
                <p className="m-0">
                  {saisie > dureeVideo
                    ? "Plus longue que la vidéo, elle empêche l’étudiant d’atteindre le seuil de validation."
                    : "Plus courte que la vidéo, elle valide la leçon avant la fin."}
                </p>
                <Button type="button" size="sm" variant="contour" onClick={() => reprendre(dureeVideo)}>
                  {`Utiliser ${minutesSecondes(dureeVideo)}`}
                </Button>
              </div>
            )}
            <p className="m-0 text-xs leading-[18px] text-discret">
              {dureeVideo !== null && !ecart
                ? "Durée lue sur la vidéo."
                : video && dureeVideo === null && !sondeMuette
                  ? "Lecture de la durée de la vidéo…"
                  : "Elle sert à mesurer le temps réellement regardé."}
            </p>
          </fieldset>
          <div className="flex flex-col gap-1">
            <Checkbox form={formulaire} name="commentaires_actifs" label="Activer les commentaires" defaultChecked={lecon.commentairesActifs} onChange={changer} />
            <div className="flex items-start gap-1">
              <Checkbox form={formulaire} name="apercu" label="Leçon d’aperçu gratuite" defaultChecked={lecon.apercu} onChange={changer} />
              <span title="Visible sans compte, même si la formation est payante." className="mt-3 flex-none text-discret">
                <Icon icon={InformationCircleIcon} size={16} label="Visible sans compte, même si la formation est payante." />
              </span>
            </div>
          </div>
          <RessourcesEditor lecon={lecon} variante="colonne" />
        </section>

        <form id={formulaire} onSubmit={soumettre} noValidate className="flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
          <input type="hidden" name="id" value={lecon.id} />
          {/* Un titre long passe à la ligne (la zone grandit avec son texte) ; Entrée n'y ajoute pas de ligne. */}
          <textarea
            name="titre"
            aria-label="Titre de la leçon"
            placeholder="Titre de la leçon"
            defaultValue={valeur("titre", lecon.titre)}
            maxLength={120}
            required
            rows={1}
            onChange={changer}
            onKeyDown={(evenement) => evenement.key === "Enter" && evenement.preventDefault()}
            className="focus-etudium w-full min-w-0 resize-none rounded-champ border-0 bg-transparent px-0 py-1 text-[28px] leading-9 font-bold text-encre outline-none [field-sizing:content] placeholder:text-indice max-sm:text-[22px] max-sm:leading-8"
          />
          {e.titre && (
            <p role="alert" className="m-0 -mt-2 text-[13px] leading-5 text-erreur-texte">
              {e.titre}
            </p>
          )}
          <input type="hidden" name="texte" value={texte} />
          <EditeurTexte
            etiquette="Texte de la leçon"
            placeholder="Le texte de la leçon : explications, liens, étapes…"
            valeur={texte}
            onChange={(suivant) => {
              setTexte(suivant);
              changer();
            }}
          />
          {e.texte && (
            <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
              {e.texte}
            </p>
          )}

          <div className="rounded-champ border border-bordure-carte">
            <button
              type="button"
              aria-expanded={deplie}
              onClick={() => setDetails(!deplie)}
              className="focus-etudium flex w-full cursor-pointer items-center justify-between gap-2 rounded-champ bg-transparent px-4 py-3 text-left text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm"
            >
              Dans cette leçon
              <Icon icon={ArrowDown01Icon} size={18} className={cn("transition-transform", deplie && "rotate-180")} />
            </button>
            {/* Repliée, les champs restent dans le formulaire : rien ne se perd à l'enregistrement. */}
            <div hidden={!deplie} className="flex flex-col gap-4 border-t border-bordure-carte px-4 py-4">
              <Field label="Résumé" htmlFor={`${id}-resume`} error={e.resume}>
                <Textarea id={`${id}-resume`} name="resume" rows={3} defaultValue={valeur("resume", lecon.resume)} maxLength={1000} onChange={changer} />
              </Field>
              <Field label="Points clés" htmlFor={`${id}-points`} hint="Un point par ligne." error={e.points_cles}>
                <Textarea id={`${id}-points`} name="points_cles" rows={4} defaultValue={valeur("points_cles", lecon.pointsCles.join("\n"))} onChange={changer} />
              </Field>
              <Field label="Titre court" htmlFor={`${id}-titre-court`} hint="Pour le programme de la page leçon, si le titre est long." error={e.titre_court}>
                <TextInput id={`${id}-titre-court`} name="titre_court" defaultValue={valeur("titre_court", lecon.titreCourt)} maxLength={40} onChange={changer} />
              </Field>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={depart !== null}
        onOpenChange={(ouvert) => !ouvert && setDepart(null)}
        tone="danger"
        title="Quitter sans enregistrer ?"
        description="Les changements de cette leçon seront perdus."
        confirmLabel="Quitter"
        onConfirm={() => {
          const vers = depart;
          setModifie(false);
          setDepart(null);
          if (vers && /^https?:/.test(vers)) window.location.assign(vers);
          else if (vers) router.push(vers);
        }}
      />
    </div>
  );
}
