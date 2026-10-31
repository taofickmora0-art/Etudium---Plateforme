"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert02Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Logout03Icon,
  Quiz01Icon,
  Refresh01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Tag } from "@/components/ui/Tag";
import { TextInput } from "@/components/ui/TextInput";
import { cn } from "@/lib/cn";
import { envoyerQuiz } from "@/lib/quiz/actions";
import type { GenreQuestion, QuestionAPasser, QuizAPasser, ReponsesQuiz, ResultatQuiz } from "@/lib/quiz/types";

const TYPES: Record<GenreQuestion, string> = { unique: "Choix unique", multiple: "Réponses multiples", vrai_faux: "Vrai ou faux", courte: "Réponse courte" };
const CONSIGNES: Record<GenreQuestion, string> = {
  unique: "Une seule réponse est possible.",
  multiple: "Plusieurs réponses sont possibles.",
  vrai_faux: "Choisissez vrai ou faux.",
  courte: "Écrivez votre réponse : les majuscules et les accents ne comptent pas.",
};
const LETTRES = "ABCDEF";
const ECHEC = "Le quiz n’a pas pu être envoyé. Réessayez.";
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const CARTE = "flex min-w-0 flex-col gap-6 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:gap-5 max-sm:p-4";

/** Une réponse donnée : les choix cochés, ou le texte d'une réponse courte. */
type Reponse = number[] | string;
const repondue = (r: Reponse | undefined) => (typeof r === "string" ? r.trim() !== "" : Array.isArray(r) && r.length > 0);

type Etape = { vue: "accueil" } | { vue: "questions"; index: number } | { vue: "resultat"; resultat: ResultatQuiz };

type QuizLeconProps = {
  leconId: string;
  quiz: QuizAPasser;
  /** « Revoir la leçon » : l'élément qui précède dans le programme. */
  precedente?: string;
  /** « Continuer » : l'élément qui suit. */
  suivante?: string;
  /** L'équipe ou le formateur en aperçu : les questions se parcourent, rien n'est envoyé ni noté (tâche 12). */
  apercu?: boolean;
};

/**
 * Passer un quiz (lot 3, spec §2 ; NdQuiz, NdQuizQuitter, NdQuizResultat) : l'accueil (questions, meilleur score, score
 * minimal), puis une question à la fois, puis le résultat corrigé par la base et le détail des réponses. Tentatives
 * illimitées ; quitter en cours de route n'enregistre rien.
 */
export function QuizLecon({ leconId, quiz, precedente, suivante, apercu = false }: QuizLeconProps) {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>({ vue: "accueil" });
  const [reponses, setReponses] = useState<Record<string, Reponse>>({});
  const [meilleur, setMeilleur] = useState(quiz.meilleur);
  const [tentatives, setTentatives] = useState(quiz.tentatives);
  const [erreur, setErreur] = useState<string | null>(null);
  const [quitter, setQuitter] = useState(false);
  const [envoi, demarrer] = useTransition();
  // Les questions du début de la tentative : si le quiz change pendant ce temps (page rafraîchie), elles restent.
  const [questions, setQuestions] = useState(quiz.questions);
  const total = questions.length;
  const titreQuestion = useRef<HTMLHeadingElement>(null);
  const boutonCommencer = useRef<HTMLButtonElement>(null);
  // Le focus suit le quiz (question suivante, retour à l'accueil) : au clavier et au lecteur d'écran, rien ne se perd.
  const etapeVue = useRef(etape);
  useEffect(() => {
    if (etapeVue.current === etape) return;
    etapeVue.current = etape;
    if (etape.vue === "questions") titreQuestion.current?.focus();
    else if (etape.vue === "accueil") boutonCommencer.current?.focus();
  }, [etape]);

  const commencer = () => {
    setQuestions(quiz.questions);
    setReponses({});
    setErreur(null);
    setEtape({ vue: "questions", index: 0 });
  };

  const envoyer = (toutes: Record<string, Reponse>) => {
    setErreur(null);
    // En aperçu, la dernière question ramène à l'accueil du quiz : rien n'est envoyé.
    if (apercu) return setEtape({ vue: "accueil" });
    demarrer(async () => {
      const envoyees: ReponsesQuiz = Object.fromEntries(
        Object.entries(toutes)
          .filter(([, r]) => repondue(r))
          .map(([id, r]) => [id, typeof r === "string" ? r.trim() : [...r].sort((a, b) => a - b)]),
      );
      const reponse = await envoyerQuiz(leconId, envoyees).catch(() => ({ ok: false as const, message: ECHEC }));
      if (!reponse.ok) {
        setErreur(reponse.message);
        return;
      }
      setMeilleur(reponse.resultat.meilleur);
      setTentatives(reponse.resultat.numero);
      setEtape({ vue: "resultat", resultat: reponse.resultat });
      // Le programme et la fiche affichent le meilleur score.
      router.refresh();
    });
  };

  /** Valider ou passer la question : la suivante, ou l'envoi après la dernière. */
  const avancer = (index: number, suite: Record<string, Reponse>) => {
    if (index + 1 < total) setEtape({ vue: "questions", index: index + 1 });
    else envoyer(suite);
  };

  if (etape.vue === "resultat") {
    return <Resultat resultat={etape.resultat} precedente={precedente} suivante={suivante} onRecommencer={commencer} />;
  }

  if (etape.vue === "accueil") {
    return (
      <section aria-label="Quiz" className={CARTE}>
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex size-12 flex-none items-center justify-center rounded-bouton bg-bleu-clair text-encre max-sm:size-10">
            <Icon icon={Quiz01Icon} size={24} />
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="m-0 text-[15px] leading-[22px] font-medium text-encre max-sm:text-sm">
              {`${pluriel(quiz.questions.length, "question")} · meilleur score : ${meilleur === null ? "—" : `${meilleur} %`} · score minimal : ${quiz.scoreMinimal} %`}
            </p>
            <p className="m-0 text-[13px] leading-5 text-discret max-sm:text-xs">
              {tentatives > 0 ? `${pluriel(tentatives, "tentative")} · tentatives illimitées` : "Tentatives illimitées : seul votre meilleur score est gardé."}
            </p>
          </div>
        </div>
        {apercu && (
          <p className="m-0 rounded-champ bg-attention-fond px-3 py-2.5 text-[13px] leading-5 text-attention-texte">
            Aperçu : parcourez les questions comme un étudiant ; vos réponses ne sont ni envoyées ni notées.
          </p>
        )}
        {quiz.questions.length === 0 ? (
          <p className="m-0 text-sm leading-[22px] text-discret">Ce quiz n’a pas encore de questions.</p>
        ) : (
          <Button ref={boutonCommencer} iconRight={ArrowRight01Icon} onClick={commencer} className="self-start max-sm:w-full">
            {tentatives > 0 ? "Recommencer" : "Commencer"}
          </Button>
        )}
      </section>
    );
  }

  const { index } = etape;
  const question = questions[index];
  const choisie = reponses[question.id];
  const repondre = (r: Reponse) => {
    setErreur(null);
    setReponses({ ...reponses, [question.id]: r });
  };

  return (
    <section aria-label="Quiz" className={CARTE}>
      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm leading-[22px] font-semibold text-encre">{`Question ${index + 1} sur ${total}`}</span>
            <span className="text-[13px] leading-5 text-discret max-sm:text-xs">{`Tentative n° ${tentatives + 1} · tentatives illimitées`}</span>
          </div>
          <Button variant="contour" size="sm" iconLeft={Logout03Icon} onClick={() => setQuitter(true)} disabled={envoi}>
            Quitter
          </Button>
        </div>
        <ProgressBar value={(100 * (index + 1)) / total} label="Avancement du quiz" />
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <Tag tone="nouveau" className="self-start">
          {TYPES[question.genre]}
        </Tag>
        <h2 ref={titreQuestion} tabIndex={-1} className="m-0 text-[28px] leading-9 font-medium tracking-[-0.01em] text-balance text-titre outline-none max-sm:text-xl max-sm:leading-7">
          {question.enonce}
        </h2>
        <p className="m-0 text-sm leading-[22px] text-pretty text-discret max-sm:text-[13px] max-sm:leading-5">{CONSIGNES[question.genre]}</p>
      </div>

      <ChoixReponse key={question.id} question={question} reponse={choisie} onChange={repondre} />

      {erreur && (
        <p role="alert" className="m-0 rounded-champ bg-erreur-fond px-3 py-2.5 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}

      <div aria-hidden="true" className="h-px bg-separateur" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {index > 0 ? (
          <Button variant="contour" iconLeft={ArrowLeft02Icon} onClick={() => setEtape({ vue: "questions", index: index - 1 })} disabled={envoi}>
            Question précédente
          </Button>
        ) : (
          <span />
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="discret"
            disabled={envoi}
            onClick={() => {
              const suite = { ...reponses };
              delete suite[question.id];
              setReponses(suite);
              avancer(index, suite);
            }}
          >
            Passer cette question
          </Button>
          <Button iconRight={ArrowRight01Icon} disabled={!repondue(choisie)} loading={envoi} onClick={() => avancer(index, reponses)}>
            Valider
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={quitter}
        onOpenChange={setQuitter}
        tone="danger"
        icon={Alert02Icon}
        iconTone="attention"
        title="Quitter le quiz ?"
        description="Vos réponses ne seront pas enregistrées. Vous pourrez recommencer le quiz plus tard."
        cancelLabel="Continuer le quiz"
        returnFocus={() => boutonCommencer.current}
        confirmLabel="Quitter"
        onConfirm={() => {
          setReponses({});
          setErreur(null);
          setEtape({ vue: "accueil" });
        }}
      />
    </section>
  );
}

/** Les réponses d'une question : des boutons à cocher (A, B, C…), ou un champ pour une réponse courte. */
function ChoixReponse({ question, reponse, onChange }: { question: QuestionAPasser; reponse: Reponse | undefined; onChange: (r: Reponse) => void }) {
  if (question.genre === "courte") {
    return (
      <TextInput
        aria-label="Votre réponse"
        placeholder="Votre réponse"
        value={typeof reponse === "string" ? reponse : ""}
        maxLength={300}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }
  const multiple = question.genre === "multiple";
  const cochees = Array.isArray(reponse) ? reponse : [];
  return (
    <div role="group" aria-label="Réponses" className="flex flex-col gap-2.5">
      {question.choix.map((texte, i) => {
        const cochee = cochees.includes(i);
        return (
          <button
            key={i}
            type="button"
            aria-pressed={cochee}
            onClick={() => onChange(multiple ? (cochee ? cochees.filter((c) => c !== i) : [...cochees, i]) : [i])}
            className={cn(
              "focus-etudium flex w-full cursor-pointer items-center gap-3.5 rounded-bouton border bg-panneau px-4 py-3.5 text-left transition-colors hover:bg-page max-sm:gap-3 max-sm:px-3 max-sm:py-3",
              cochee ? "border-bleu shadow-[inset_0_0_0_1px_var(--color-bleu)]" : "border-bordure-carte",
            )}
          >
            <span aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-champ bg-bleu-clair text-sm font-semibold text-encre">
              {LETTRES[i]}
            </span>
            <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{texte}</span>
            <span
              aria-hidden="true"
              className={cn(
                "flex size-5 flex-none items-center justify-center border-[1.5px]",
                multiple ? "rounded-[4px]" : "rounded-full",
                cochee ? "border-bleu bg-bleu text-white" : "border-inactif bg-panneau",
              )}
            >
              {cochee && (multiple ? <Icon icon={Tick02Icon} size={14} /> : <span className="size-2 rounded-full bg-panneau" />)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Le résultat (NdQuizResultat) : réussi ou pas encore, le score, le détail des réponses et la suite. */
function Resultat({ resultat, precedente, suivante, onRecommencer }: { resultat: ResultatQuiz; precedente?: string; suivante?: string; onRecommencer: () => void }) {
  const { reussi } = resultat;
  const titreDetail = useId();
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => titre.current?.focus(), []);
  return (
    <section aria-label="Résultat du quiz" className={CARTE}>
      <Tag tone="enAttente" className="self-start">{`Tentative n° ${resultat.numero}`}</Tag>
      <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 rounded-bouton px-6 py-5 max-sm:px-4 max-sm:py-4", reussi ? "bg-reussite-fond" : "bg-attention-fond")}>
        <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3.5">
          <span className={cn("flex flex-none", reussi ? "text-reussite-texte" : "text-attention-texte")}>
            <Icon icon={reussi ? CheckmarkCircle02Icon : Alert02Icon} size={28} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 ref={titre} tabIndex={-1} className="m-0 text-[28px] leading-9 font-medium tracking-[-0.01em] text-titre outline-none max-sm:text-xl max-sm:leading-7">
              {reussi ? "Quiz réussi" : "Pas encore réussi"}
            </h2>
            <span className="text-sm leading-[22px] text-encre max-sm:text-[13px] max-sm:leading-5">
              {`${resultat.bonnes} ${resultat.bonnes > 1 ? "bonnes réponses" : "bonne réponse"} sur ${resultat.total} · score minimal : ${resultat.scoreMinimal} %`}
            </span>
          </div>
        </div>
        <span className={cn("flex-none text-[32px] leading-10 font-medium tracking-[-0.01em] max-sm:text-[28px] max-sm:leading-9", reussi ? "text-reussite-texte" : "text-attention-texte")}>
          {`${resultat.score} %`}
        </span>
      </div>
      <p className="m-0 text-sm leading-[22px] text-pretty text-texte">
        {reussi
          ? `Vous pouvez recommencer autant de fois que vous le souhaitez : seul votre meilleur score est gardé (${resultat.meilleur} %).`
          : `Il faut ${resultat.scoreMinimal} % pour réussir ce quiz. Revoyez les réponses ci-dessous, puis recommencez : seul votre meilleur score est gardé (${resultat.meilleur} %).`}
      </p>

      <div className="flex min-w-0 flex-col gap-1">
        <h3 id={titreDetail} className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg">
          Détail des réponses
        </h3>
        <ol aria-labelledby={titreDetail} className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-separateur">
          {resultat.detail.map((d, i) => (
            <li key={d.questionId || i} className="flex items-start gap-3.5 px-1 py-4 max-sm:gap-3 max-sm:px-0">
              <span aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-champ bg-bleu-clair text-sm font-semibold text-encre">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] leading-[22px] font-medium text-encre max-sm:text-sm">{d.enonce}</span>
                <span className="text-[13px] leading-5 text-discret">
                  Votre réponse : <span className="font-medium text-texte">{d.votreReponse || "sans réponse"}</span>
                </span>
                {!d.correcte && (
                  <span className="text-[13px] leading-5 text-discret">
                    Bonne réponse : <span className="font-medium text-texte">{d.bonneReponse}</span>
                    {d.explication ? `. ${d.explication}` : ""}
                  </span>
                )}
              </div>
              <Tag tone={d.correcte ? "valide" : "echoue"} icon={d.correcte ? Tick02Icon : Cancel01Icon} className="flex-none">
                {d.correcte ? "Correct" : "Incorrect"}
              </Tag>
            </li>
          ))}
        </ol>
      </div>

      <div aria-hidden="true" className="h-px bg-separateur" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {precedente && (
            <Link href={precedente} className={buttonVariants({ variant: "contour" })}>
              <Icon icon={ArrowLeft02Icon} size={18} />
              <span>Revoir la leçon</span>
            </Link>
          )}
          <Button variant="contour" iconLeft={Refresh01Icon} onClick={onRecommencer}>
            Recommencer
          </Button>
        </div>
        {suivante && (
          <Link href={suivante} className={buttonVariants()}>
            <span>Continuer</span>
            <Icon icon={ArrowRight01Icon} size={18} />
          </Link>
        )}
      </div>
    </section>
  );
}
