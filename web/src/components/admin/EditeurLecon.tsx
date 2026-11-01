"use client";

import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, InformationCircleIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { LecteurVideo } from "@/components/lecon/LecteurVideo";
import { BandeauBrouillon } from "@/components/editeur/BandeauBrouillon";
import { IndicateurSauvegarde } from "@/components/editeur/IndicateurSauvegarde";
import { useSauvegardeAuto } from "@/components/editeur/useSauvegardeAuto";
import { SondeDureeVideo } from "./SondeDureeVideo";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { changerStatutLecon } from "@/lib/admin/actions";
import { baseFormations } from "@/lib/admin/espace";
import type { LeconAdmin } from "@/lib/admin/types";
import { parseVideoUrl, videoLabel, videoLink } from "@/lib/admin/video";
import { enregistrerLecon, enregistrerQuestions, reglerLecon } from "@/lib/editeur/actions";
import type { SaisieLecon } from "@/lib/editeur/types";
import { depuisMarkdown, type DocumentLecon } from "@/lib/lecon/document";
import { estMesuree, messageLienCourt } from "@/lib/video/plateformes";
import { MIGRATION_QUIZ } from "@/lib/quiz/conversion";
import type { QuestionQuiz } from "@/lib/quiz/types";
import type { Lecture } from "@/lib/utilisateurs/types";
import { EditeurQuiz } from "./EditeurQuiz";
import { RessourcesEditor } from "./RessourcesEditor";
import { RadioGroup } from "@/components/ui/RadioGroup";
import type { GenreExercice } from "@/lib/exercices/types";
import { StatutLecon } from "./StatutLecon";

// L'éditeur riche (fin du lot 4), chargé à part : titres, listes, images, tableaux, blocs d'information, vidéos.
const EditeurRiche = dynamic(() => import("@/components/editeur/EditeurRiche").then((m) => m.EditeurRiche), {
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
  if (!lien.trim()) return "YouTube, Vimeo, TikTok, Tella, Loom, ScreenPal ou Google Drive, par exemple https://youtu.be/…";
  const video = parseVideoUrl(lien);
  if (video) return `Reconnu : ${videoLabel(video)}`;
  return messageLienCourt(lien) ?? "Lien non reconnu : collez un lien YouTube, Vimeo, TikTok, Tella, Loom, ScreenPal ou Google Drive.";
}

type EditeurLeconProps = {
  lecon: LeconAdmin;
  /** Adresse de base des formations : le back-office, ou l'espace formateur. */
  base?: "/admin/formations" | "/formateur/formations";
  /** Les questions d'un quiz (0031), avec leurs bonnes réponses. */
  quiz?: Lecture<QuestionQuiz[]>;
};

/** Ce que l'éditeur ouvre : le brouillon s'il existe (0056), sinon ce qui est en ligne. */
function saisieDe(lecon: LeconAdmin): SaisieLecon {
  return (
    lecon.edition?.donnees ?? {
      titre: lecon.titre,
      titreCourt: lecon.titreCourt ?? "",
      resume: lecon.resume,
      pointsCles: lecon.pointsCles,
      lienVideo: lecon.video ? videoLink(lecon.video) : "",
      duree: minutesSecondes(lecon.dureeSecondes),
      document: lecon.document ?? depuisMarkdown(lecon.texte),
    }
  );
}

/**
 * L'éditeur d'une leçon (refonte des formations, spec §3.4, d'après izimentor ; fin du lot 4) : une barre en haut (retour
 * aux leçons, « Leçon 2 sur 5 · Module 1 », ‹ ›, statut, état de la sauvegarde, Voir comme un étudiant) ; à gauche les
 * réglages (vidéo et son aperçu, durée, commentaires, aperçu gratuit, documents) ; à droite le titre et le contenu riche,
 * puis « Dans cette leçon ». Tout s'enregistre seul ; une leçon en ligne, dans son brouillon, jusqu'à « Publier ».
 *
 * Un quiz (lot 3) : l'éditeur de ses questions à la place de la vidéo et du texte, avec « Enregistrer les questions ».
 */
export function EditeurLecon(props: EditeurLeconProps) {
  // Une publication, un abandon ou un rechargement change la révision : l'éditeur repart de ce que dit la base.
  const edition = props.lecon.edition;
  return <Editeur key={`${props.lecon.id}:${edition?.revision ?? 0}:${edition?.brouillon ? "b" : "l"}`} {...props} />;
}

function Editeur({ lecon, base = "/admin/formations", quiz }: EditeurLeconProps) {
  const estQuiz = lecon.type === "quiz";
  const estExercice = lecon.type === "exercice";
  // Un quiz ou un exercice (lot 3) n'a ni vidéo ni durée.
  const sansVideo = estQuiz || estExercice;
  const mots = estQuiz
    ? { titre: "Titre du quiz", publie: "Quiz publié", brouillon: "Quiz remis en brouillon", details: "Dans ce quiz" }
    : estExercice
      ? { titre: "Titre de l’exercice", publie: "Exercice publié", brouillon: "Exercice remis en brouillon", details: "Dans cet exercice" }
      : { titre: "Titre de la leçon", publie: "Leçon publiée", brouillon: "Leçon remise en brouillon", details: "Dans cette leçon" };
  const id = useId();
  const formQuestions = `${id}-questions`;
  const router = useRouter();
  const { toast } = useToast();
  const espace = base === "/formateur/formations" ? "formateur" : "admin";
  const racine = `${baseFormations(espace)}/${lecon.formationId}`;
  const retour = `${racine}?onglet=programme`;
  const versLecon = (leconId: string) => `${racine}/lecons/${leconId}`;

  // Le contenu, enregistré tout seul (0056).
  const [initiale] = useState(() => saisieDe(lecon));
  const [titre, setTitre] = useState(initiale.titre);
  const [titreCourt, setTitreCourt] = useState(initiale.titreCourt);
  const [resume, setResume] = useState(initiale.resume);
  const [pointsTexte, setPointsTexte] = useState(initiale.pointsCles.join("\n"));
  const [lien, setLien] = useState(initiale.lienVideo);
  const [minutes, setMinutes] = useState(initiale.duree.split(":")[0] ?? "0");
  const [secondes, setSecondes] = useState(String(Number(initiale.duree.split(":")[1] ?? 0)));
  const [contenu, setContenu] = useState<DocumentLecon>(initiale.document);
  const duree = `${Number(minutes) || 0}:${String(Number(secondes) || 0).padStart(2, "0")}`;
  const dureeValide = ENTIER.test(minutes.trim()) && ENTIER.test(secondes.trim()) && (Number(secondes) || 0) < 60;
  const saisie = useMemo<SaisieLecon>(
    () => ({ titre, titreCourt, resume, pointsCles: pointsTexte.split("\n"), lienVideo: lien, duree: dureeValide ? duree : "invalide", document: contenu }),
    [titre, titreCourt, resume, pointsTexte, lien, duree, dureeValide, contenu],
  );
  const sauvegarde = useSauvegardeAuto({
    cle: `lecon:${lecon.id}`,
    valeur: saisie,
    revisionInitiale: lecon.edition?.revision ?? 0,
    brouillonInitial: lecon.edition?.brouillon ?? false,
    enregistrer: (valeur, revision) => enregistrerLecon(lecon.id, valeur, revision),
  });
  const { etat } = sauvegarde;
  const e: Record<string, string> = etat.type === "invalide" ? etat.erreurs : {};
  const recuperer = () => {
    const v = sauvegarde.recuperer();
    if (!v) return;
    setTitre(v.titre);
    setTitreCourt(v.titreCourt);
    setResume(v.resume);
    setPointsTexte(v.pointsCles.join("\n"));
    setLien(v.lienVideo);
    const [m = "0", s = "0"] = v.duree.split(":");
    setMinutes(m);
    setSecondes(String(Number(s) || 0));
    setContenu(v.document);
  };

  // Les réglages : enregistrés aussitôt, sans brouillon.
  const [genre, setGenre] = useState<GenreExercice>(lecon.genreExercice ?? "rendu");
  const [commentaires, setCommentaires] = useState(lecon.commentairesActifs);
  const [apercu, setApercu] = useState(lecon.apercu);
  async function regler(suivant: { commentairesActifs: boolean; apercu: boolean; genreExercice?: GenreExercice }, annuler: () => void) {
    const r = await reglerLecon(lecon.id, suivant).catch(() => ({ ok: false, message: ECHEC }));
    if (!r.ok) {
      annuler();
      toast({ tone: "erreur", title: r.message ?? ECHEC });
    }
  }

  const [publiee, setPubliee] = useState(lecon.publiee);
  const [details, setDetails] = useState(false);
  // La vraie durée, lue sur la vidéo par le lecteur officiel ; null tant qu'elle est inconnue.
  const [dureeVideo, setDureeVideo] = useState<number | null>(null);
  // Le lecteur officiel n'a pas livré la durée (réseau, bloqueur) : la saisie reste à la main.
  const [sondeMuette, setSondeMuette] = useState(false);
  // Un lien collé ou tapé : la durée de cette vidéo remplacera celle saisie.
  const lienChange = useRef(false);
  const video = parseVideoUrl(lien);
  // Le temps regardé se mesure (YouTube, Vimeo, TikTok, Tella) : la durée se lit sur la vidéo et elle est exigée.
  const mesuree = video !== null && estMesuree(video.fournisseur);
  const saisieS = (Number(minutes) || 0) * 60 + (Number(secondes) || 0);
  const ecart = dureeVideo !== null && saisieS > 0 && Math.abs(saisieS - dureeVideo) > TOLERANCE_S;
  const reprendre = (s: number) => {
    setMinutes(String(Math.floor(s / 60)));
    setSecondes(String(s % 60));
  };
  // Un nouveau lien, ou rien de saisi : la durée exacte de la vidéo est reprise. Une leçon déjà enregistrée garde la
  // sienne, et un écart est signalé (« Utiliser 7:42 ») : rien ne change sans qu'on le voie.
  const dureeLue = (s: number) => {
    setDureeVideo(s);
    if (saisieS === 0 || lienChange.current) reprendre(s);
    lienChange.current = false;
  };
  // Une erreur dans « Dans cette leçon » : la section s'ouvre pour la montrer.
  const deplie = details || Boolean(e.resume || e.points_cles || e.titre_court);

  // Les questions d'un quiz : « Enregistrer les questions ».
  const [questionsModifiees, setQuestionsModifiees] = useState(false);
  const [erreurQuestions, setErreurQuestions] = useState<string | null>(null);
  const [enregistrementQuestions, setEnregistrementQuestions] = useState(false);
  async function enregistrerLesQuestions(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    let questions: unknown;
    try {
      questions = JSON.parse(String(new FormData(evenement.currentTarget).get("questions") ?? "[]"));
    } catch {
      setErreurQuestions("Les questions n’ont pas pu être lues. Réessayez.");
      return;
    }
    setEnregistrementQuestions(true);
    const r = await enregistrerQuestions(lecon.id, questions).catch(() => ({ ok: false, message: ECHEC }));
    setEnregistrementQuestions(false);
    if (!r.ok) {
      setErreurQuestions(r.message ?? ECHEC);
      return;
    }
    setErreurQuestions(null);
    setQuestionsModifiees(false);
    toast({ tone: "reussite", title: "Les questions ont bien été enregistrées." });
  }

  async function changerStatut(suivant: boolean) {
    setPubliee(suivant);
    const reponse = await changerStatutLecon(lecon.id, suivant).catch(() => ({ ok: false, message: ECHEC }));
    if (!reponse.ok) {
      setPubliee(!suivant);
      toast({ tone: "erreur", title: reponse.message ?? ECHEC });
    } else {
      toast({ tone: "reussite", title: suivant ? mots.publie : mots.brouillon });
    }
  }

  const { position, voisines } = lecon;
  const fleche = "focus-etudium " + iconButtonVariants({ variant: "discret", size: "sm" });
  const enregistrerMaintenant = () => void sauvegarde.enregistrerMaintenant();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* La barre du haut, qui reste visible pendant qu'on écrit. */}
      <div className="sticky top-[60px] z-20 -mx-1 sm:top-[73px] lg:top-0 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-bordure-carte bg-page/95 px-1 py-3 backdrop-blur max-sm:gap-y-1.5 max-sm:py-2">
        <Link href={retour} className="focus-etudium inline-flex min-w-0 items-center gap-1.5 rounded-puce text-[15px] leading-[22px] font-medium text-encre no-underline hover:underline max-sm:text-sm">
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
                <Link href={versLecon(voisines.precedente)} aria-label="Leçon précédente" className={fleche}>
                  <Icon icon={ArrowLeft01Icon} size={16} />
                </Link>
              )}
              {voisines.suivante && (
                <Link href={versLecon(voisines.suivante)} aria-label="Leçon suivante" className={fleche}>
                  <Icon icon={ArrowRight01Icon} size={16} />
                </Link>
              )}
            </span>
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-2 max-sm:ml-auto">
            <IndicateurSauvegarde etat={etat} />
            <StatutLecon publiee={publiee} onChange={(suivant) => void changerStatut(suivant)} />
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

      {etat.type === "conflit" && (
        <Banner
          tone="erreur"
          title={`Cette leçon vient d’être modifiée par ${etat.par ?? "quelqu’un d’autre"}.`}
          action={
            <Button size="sm" variant="contour" onClick={() => router.refresh()}>
              Recharger
            </Button>
          }
        >
          Rechargez pour voir sa version. Ce que vous venez d’écrire reste gardé sur cet appareil.
        </Banner>
      )}
      {sauvegarde.recuperation && (
        <Banner
          tone="information"
          title="Des modifications de cet appareil n’ont pas été enregistrées."
          action={
            <span className="flex flex-wrap gap-2">
              <Button size="sm" onClick={recuperer}>
                Récupérer
              </Button>
              <Button size="sm" variant="contour" onClick={sauvegarde.ignorer}>
                Ignorer
              </Button>
            </span>
          }
        />
      )}
      {e.formulaire && <Banner tone="erreur" title={e.formulaire} />}
      {sauvegarde.brouillon && <BandeauBrouillon formationId={lecon.formationId} leconId={lecon.id} />}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <section aria-label="Réglages" className="flex min-w-0 flex-col gap-5 rounded-carte border border-bordure-carte bg-bleu-clair/60 p-5 max-sm:gap-4 max-sm:p-4 lg:sticky lg:top-[72px]">
          <h2 className="m-0 text-[15px] leading-[22px] font-semibold text-encre">Réglages</h2>
          {sansVideo ? (
            <p className="m-0 text-[13px] leading-5 text-texte">
              {estQuiz
                ? "Le score minimal pour réussir se règle dans les informations de la formation. Les tentatives sont illimitées ; le meilleur score est gardé."
                : "Les fichiers fournis à l’étudiant (données, modèle) s’ajoutent dans « Documents & fichiers »."}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2.5">
                <Field label="Lien de la vidéo" htmlFor={`${id}-video`} hint={aideVideo(lien)} error={e.video}>
                  <TextInput
                    id={`${id}-video`}
                    type="url"
                    inputMode="url"
                    value={lien}
                    onBlur={enregistrerMaintenant}
                    onChange={(evenement) => {
                      const avant = parseVideoUrl(lien);
                      const apres = parseVideoUrl(evenement.target.value);
                      setLien(evenement.target.value);
                      // Une autre vidéo (pas le même lien retouché, « ?t=5 ») : sa durée sera relue.
                      if (apres?.fournisseur !== avant?.fournisseur || apres?.id !== avant?.id) {
                        setDureeVideo(null);
                        setSondeMuette(false);
                        lienChange.current = true;
                      }
                    }}
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </Field>
                {video && <LecteurVideo video={video} titre={titre} />}
                {video && mesuree && <SondeDureeVideo key={`${video.fournisseur}:${video.id}`} video={video} onDuree={dureeLue} onEchec={() => setSondeMuette(true)} />}
                {video && !mesuree && (
                  <div className="flex flex-col gap-1 text-[13px] leading-5 text-texte">
                    <p className="m-0">Cette plateforme ne permet pas de mesurer le temps regardé : la leçon se terminera d’un clic sur « Terminer la leçon ».</p>
                    {video.fournisseur === "drive" && (
                      <p className="m-0 text-discret">Partagez la vidéo avec « Tous les utilisateurs disposant du lien », et dans les réglages du partage (roue dentée), décochez l’option qui permet aux lecteurs de télécharger, imprimer et copier. Drive peut bloquer une vidéo très regardée, jusqu’à 24 h.</p>
                    )}
                  </div>
                )}
              </div>
              <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                <legend className="mb-1.5 p-0 text-sm leading-5 font-semibold text-encre">Durée de la vidéo</legend>
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-discret">
                    <TextInput type="number" min={0} aria-label="Minutes" step={1} inputMode="numeric" value={minutes} onChange={(ev) => setMinutes(ev.target.value)} className="h-10 min-w-0" />
                    min
                  </label>
                  <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] text-discret">
                    <TextInput type="number" min={0} max={59} aria-label="Secondes" step={1} inputMode="numeric" value={secondes} onChange={(ev) => setSecondes(ev.target.value)} className="h-10 min-w-0" />
                    s
                  </label>
                </div>
                {(!dureeValide || e.duree) && (
                  <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
                    {!dureeValide ? DUREE_ENTIERE : e.duree}
                  </p>
                )}
                {ecart && dureeVideo !== null && (
                  <div role="status" className="flex flex-col items-start gap-2 rounded-champ bg-attention-fond px-3 py-2.5 text-[13px] leading-5 text-attention-texte">
                    <p className="m-0 font-medium">{`La vidéo dure ${minutesSecondes(dureeVideo)} ; la durée saisie est ${minutesSecondes(saisieS)}.`}</p>
                    <p className="m-0">
                      {saisieS > dureeVideo ? "Plus longue que la vidéo, elle empêche l’étudiant d’atteindre le seuil de validation." : "Plus courte que la vidéo, elle valide la leçon avant la fin."}
                    </p>
                    <Button type="button" size="sm" variant="contour" onClick={() => reprendre(dureeVideo)}>
                      {`Utiliser ${minutesSecondes(dureeVideo)}`}
                    </Button>
                  </div>
                )}
                <p className="m-0 text-xs leading-[18px] text-discret">
                  {video && !mesuree
                    ? "Facultative : elle s’affiche aux étudiants."
                    : dureeVideo !== null && !ecart
                      ? "Durée lue sur la vidéo."
                      : mesuree && dureeVideo === null && !sondeMuette
                        ? "Lecture de la durée de la vidéo…"
                        : mesuree && sondeMuette
                          ? "Durée non lue sur la vidéo : saisissez-la à la main."
                          : "Elle sert à mesurer le temps réellement regardé."}
                </p>
              </fieldset>
            </>
          )}
          <div className="flex flex-col gap-1">
            <Checkbox
              label="Activer les commentaires"
              checked={commentaires}
              onChange={(ev) => {
                const suivant = ev.target.checked;
                setCommentaires(suivant);
                void regler({ commentairesActifs: suivant, apercu, genreExercice: estExercice ? genre : undefined }, () => setCommentaires(!suivant));
              }}
            />
            {/* L'aperçu gratuit concerne les leçons : un quiz se passe et un exercice se rend avec un compte. */}
            {!sansVideo && (
              <div className="flex items-start gap-1">
                <Checkbox
                  label="Leçon d’aperçu gratuite"
                  checked={apercu}
                  onChange={(ev) => {
                    const suivant = ev.target.checked;
                    setApercu(suivant);
                    void regler({ commentairesActifs: commentaires, apercu: suivant }, () => setApercu(!suivant));
                  }}
                />
                <span title="Visible sans compte, même si la formation est payante." className="mt-3 flex-none text-discret">
                  <Icon icon={InformationCircleIcon} size={16} label="Visible sans compte, même si la formation est payante." />
                </span>
              </div>
            )}
          </div>
          {/* Un quiz : pas de documents (la page du quiz ne les montre pas). */}
          {!estQuiz && <RessourcesEditor lecon={lecon} variante="colonne" />}
        </section>

        <div className="flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
          {/* Un titre long passe à la ligne (la zone grandit avec son texte) ; Entrée n'y ajoute pas de ligne. */}
          <textarea
            aria-label={mots.titre}
            placeholder={mots.titre}
            value={titre}
            maxLength={120}
            required
            rows={1}
            onChange={(ev) => setTitre(ev.target.value)}
            onBlur={enregistrerMaintenant}
            onKeyDown={(ev) => ev.key === "Enter" && ev.preventDefault()}
            className="focus-etudium w-full min-w-0 resize-none rounded-champ border-0 bg-transparent px-0 py-1 text-[28px] leading-9 font-bold text-encre outline-none [field-sizing:content] placeholder:text-indice max-sm:text-[22px] max-sm:leading-8"
          />
          {e.titre && (
            <p role="alert" className="m-0 -mt-2 text-[13px] leading-5 text-erreur-texte">
              {e.titre}
            </p>
          )}
          {estQuiz ? (
            quiz?.migrationAbsente ? (
              <Banner tone="attention" title={MIGRATION_QUIZ} />
            ) : (
              <form id={formQuestions} onSubmit={(ev) => void enregistrerLesQuestions(ev)} noValidate className="flex min-w-0 flex-col gap-3">
                <EditeurQuiz questions={quiz?.donnees ?? []} form={formQuestions} erreur={erreurQuestions ?? undefined} onChange={() => setQuestionsModifiees(true)} />
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {questionsModifiees && <span className="text-[13px] leading-5 text-discret">Questions modifiées, pas encore enregistrées</span>}
                  <Button type="submit" size="sm" loading={enregistrementQuestions}>
                    Enregistrer les questions
                  </Button>
                </div>
              </form>
            )
          ) : (
            <>
              {estExercice && (
                <RadioGroup
                  label="Genre de l’exercice"
                  showLabel
                  name={`${id}-genre`}
                  value={genre}
                  onValueChange={(valeur) => {
                    const suivant: GenreExercice = valeur === "simple" ? "simple" : "rendu";
                    const avant = genre;
                    setGenre(suivant);
                    void regler({ commentairesActifs: commentaires, apercu: false, genreExercice: suivant }, () => setGenre(avant));
                  }}
                  options={[
                    { value: "rendu", label: "Avec rendu : l’étudiant dépose un fichier, que vous corrigez." },
                    { value: "simple", label: "Simple : l’étudiant le marque comme terminé." },
                  ]}
                />
              )}
              <EditeurRiche
                formationId={lecon.formationId}
                images={lecon.images ?? {}}
                etiquette={estExercice ? "Consigne" : "Texte de la leçon"}
                placeholder={estExercice ? "La consigne : ce qu’il faut faire, ce qu’il faut rendre…" : "Le texte de la leçon : explications, liens, étapes…"}
                valeur={contenu}
                onChange={setContenu}
                onBlur={enregistrerMaintenant}
              />
              {e.texte && (
                <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
                  {e.texte}
                </p>
              )}
            </>
          )}

          <div className="rounded-champ border border-bordure-carte">
            <button
              type="button"
              aria-expanded={deplie}
              onClick={() => setDetails(!deplie)}
              className="focus-etudium flex w-full cursor-pointer items-center justify-between gap-2 rounded-champ bg-transparent px-4 py-3 text-left text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm"
            >
              {mots.details}
              <Icon icon={ArrowDown01Icon} size={18} className={cn("transition-transform", deplie && "rotate-180")} />
            </button>
            <div hidden={!deplie} className="flex flex-col gap-4 border-t border-bordure-carte px-4 py-4">
              {/* Un quiz ou un exercice n'a ni résumé ni points clés. */}
              <div hidden={sansVideo} className="flex flex-col gap-4">
                <Field label="Résumé" htmlFor={`${id}-resume`} error={e.resume}>
                  <Textarea id={`${id}-resume`} rows={3} value={resume} maxLength={1000} onChange={(ev) => setResume(ev.target.value)} onBlur={enregistrerMaintenant} />
                </Field>
                <Field label="Points clés" htmlFor={`${id}-points`} hint="Un point par ligne." error={e.points_cles}>
                  <Textarea id={`${id}-points`} rows={4} value={pointsTexte} onChange={(ev) => setPointsTexte(ev.target.value)} onBlur={enregistrerMaintenant} />
                </Field>
              </div>
              <Field label="Titre court" htmlFor={`${id}-titre-court`} hint="Pour le programme de la page leçon, si le titre est long." error={e.titre_court}>
                <TextInput id={`${id}-titre-court`} value={titreCourt} maxLength={40} onChange={(ev) => setTitreCourt(ev.target.value)} onBlur={enregistrerMaintenant} />
              </Field>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
