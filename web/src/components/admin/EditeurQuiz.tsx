"use client";

import { useId, useState } from "react";
import { Add01Icon, ArrowDown02Icon, ArrowUp02Icon, Cancel01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { choiceInputClasses, choiceRowClasses } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { identifiantAleatoire } from "@/lib/identifiant";
import type { GenreQuestion, QuestionQuiz } from "@/lib/quiz/types";

const TYPES: { value: GenreQuestion; label: string }[] = [
  { value: "unique", label: "Choix unique" },
  { value: "multiple", label: "Réponses multiples" },
  { value: "vrai_faux", label: "Vrai ou faux" },
  { value: "courte", label: "Réponse courte" },
];
const MIN_CHOIX = 2;
const MAX_CHOIX = 6;
const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

type Ligne = { cle: string; question: QuestionQuiz };

// Une nouvelle question reçoit son identifiant tout de suite : la base le reprend, et il ne change plus ensuite.
const nouvelleQuestion = (): QuestionQuiz => ({
  id: identifiantAleatoire(),
  genre: "unique",
  enonce: "",
  choix: [
    { texte: "", correcte: true },
    { texte: "", correcte: false },
  ],
  reponses: [],
  explication: "",
});

/** Une seule bonne réponse : la première cochée, sinon la première. */
const uneSeule = (choix: QuestionQuiz["choix"]) => {
  const bonne = Math.max(0, choix.findIndex((c) => c.correcte));
  return choix.map((c, i) => ({ ...c, correcte: i === bonne }));
};

/** Changer de type garde ce qui peut l'être (l'énoncé, l'explication, les réponses écrites). */
function changerGenre(q: QuestionQuiz, genre: GenreQuestion): QuestionQuiz {
  if (genre === "vrai_faux") {
    return { ...q, genre, choix: [{ texte: "Vrai", correcte: true }, { texte: "Faux", correcte: false }] };
  }
  if (genre === "courte") return { ...q, genre, reponses: q.reponses.length > 0 ? q.reponses : [""] };
  const choix = q.choix.length >= MIN_CHOIX ? q.choix : nouvelleQuestion().choix;
  return { ...q, genre, choix: genre === "unique" ? uneSeule(choix) : choix };
}

/** Ce qui part à la base : la question et son identifiant (gardé : une tentative en cours reste valable). */
const versEnvoi = ({ id, genre, enonce, choix, reponses, explication }: QuestionQuiz) => ({ id, genre, enonce, choix, reponses, explication });

type EditeurQuizProps = {
  questions: QuestionQuiz[];
  /** Le formulaire de la leçon : les questions partent avec lui, en JSON. */
  form: string;
  /** Le refus de la base (« La question 2 n'a pas d'énoncé. »). */
  erreur?: string;
  onChange?: () => void;
};

/**
 * L'éditeur des questions d'un quiz (lot 3, spec §2) : quatre types (choix unique, réponses multiples, vrai ou faux,
 * réponse courte), de 2 à 6 réponses et la ou les bonnes, une explication facultative ; on ajoute, range et supprime.
 * La base vérifie chaque question à l'enregistrement et dit laquelle corriger.
 */
export function EditeurQuiz({ questions, form, erreur, onChange }: EditeurQuizProps) {
  const id = useId();
  const [lignes, setLignes] = useState<Ligne[]>(() => questions.map((question) => ({ cle: question.id ?? identifiantAleatoire(), question })));

  const changer = (suivantes: Ligne[]) => {
    setLignes(suivantes);
    onChange?.();
  };
  const modifier = (index: number, maj: (q: QuestionQuiz) => QuestionQuiz) => changer(lignes.map((l, i) => (i === index ? { ...l, question: maj(l.question) } : l)));
  const deplacer = (index: number, vers: number) => {
    const suivantes = [...lignes];
    const [ligne] = suivantes.splice(index, 1);
    suivantes.splice(vers, 0, ligne);
    changer(suivantes);
  };
  const ajouter = () => {
    const question = nouvelleQuestion();
    changer([...lignes, { cle: question.id ?? `${id}-${lignes.length}`, question }]);
  };

  return (
    <section aria-labelledby={`${id}-titre`} className="flex min-w-0 flex-col gap-4">
      <input type="hidden" form={form} name="questions" value={JSON.stringify(lignes.map((l) => versEnvoi(l.question)))} />
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`${id}-titre`} className="m-0 text-lg leading-7 font-semibold text-encre max-sm:text-base">
          Questions
        </h2>
        <span className="text-[13px] leading-5 text-discret">{pluriel(lignes.length, "question")}</span>
      </div>
      {erreur && (
        <p role="alert" className="m-0 rounded-champ bg-erreur-fond px-3 py-2.5 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      {lignes.length === 0 && <p className="m-0 text-[13px] leading-5 text-discret">Aucune question pour le moment.</p>}
      {lignes.map((ligne, index) => (
        <CarteQuestion
          key={ligne.cle}
          rang={index + 1}
          total={lignes.length}
          question={ligne.question}
          onChange={(maj) => modifier(index, maj)}
          onMonter={() => deplacer(index, index - 1)}
          onDescendre={() => deplacer(index, index + 1)}
          onSupprimer={() => changer(lignes.filter((_, i) => i !== index))}
        />
      ))}
      <Button type="button" variant="contour" iconLeft={Add01Icon} onClick={ajouter} className="self-start">
        Ajouter une question
      </Button>
    </section>
  );
}

function CarteQuestion({
  rang,
  total,
  question: q,
  onChange,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  rang: number;
  total: number;
  question: QuestionQuiz;
  onChange: (maj: (q: QuestionQuiz) => QuestionQuiz) => void;
  onMonter: () => void;
  onDescendre: () => void;
  onSupprimer: () => void;
}) {
  const id = useId();
  const choixMultiple = q.genre === "multiple";
  const fixerChoix = (choix: QuestionQuiz["choix"]) => onChange((actuelle) => ({ ...actuelle, choix }));
  const fixerReponses = (reponses: string[]) => onChange((actuelle) => ({ ...actuelle, reponses }));

  return (
    <fieldset aria-label={`Question ${rang}`} className="m-0 flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-4 max-sm:gap-3 max-sm:p-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{`Question ${rang}`}</span>
        <span className="ml-auto flex items-center gap-1">
          {rang > 1 && <IconButton icon={ArrowUp02Icon} label={`Monter la question ${rang}`} variant="discret" size="sm" onClick={onMonter} />}
          {rang < total && <IconButton icon={ArrowDown02Icon} label={`Descendre la question ${rang}`} variant="discret" size="sm" onClick={onDescendre} />}
          <IconButton icon={Delete02Icon} label={`Supprimer la question ${rang}`} variant="discret" size="sm" onClick={onSupprimer} />
        </span>
      </div>
      <Field label="Type de question" htmlFor={`${id}-type`}>
        <Select id={`${id}-type`} options={TYPES} value={q.genre} onChange={(e) => onChange((actuelle) => changerGenre(actuelle, e.target.value as GenreQuestion))} />
      </Field>
      <Field label="Énoncé" htmlFor={`${id}-enonce`}>
        <Textarea id={`${id}-enonce`} rows={2} maxLength={1000} value={q.enonce} onChange={(e) => onChange((actuelle) => ({ ...actuelle, enonce: e.target.value }))} />
      </Field>

      {q.genre === "vrai_faux" && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-sm leading-5 font-medium text-encre">Bonne réponse</legend>
          {q.choix.map((c, i) => (
            <label key={c.texte} className={choiceRowClasses}>
              <input type="radio" name={`${id}-bonne`} checked={c.correcte} onChange={() => fixerChoix(q.choix.map((d, j) => ({ ...d, correcte: i === j })))} className={choiceInputClasses} />
              <span>{c.texte}</span>
            </label>
          ))}
        </fieldset>
      )}

      {(q.genre === "unique" || q.genre === "multiple") && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm leading-5 font-medium text-encre">Réponses</legend>
          <p className="m-0 mb-1 text-xs leading-[18px] text-discret">
            {choixMultiple ? "Cochez toutes les bonnes réponses." : "Cochez la bonne réponse."} De {MIN_CHOIX} à {MAX_CHOIX} réponses.
          </p>
          {q.choix.map((c, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <input
                type={choixMultiple ? "checkbox" : "radio"}
                name={`${id}-bonne`}
                aria-label={`Bonne réponse : réponse ${i + 1}`}
                checked={c.correcte}
                onChange={() => fixerChoix(q.choix.map((d, j) => (choixMultiple ? (i === j ? { ...d, correcte: !d.correcte } : d) : { ...d, correcte: i === j })))}
                className={choiceInputClasses + " mt-0"}
              />
              <TextInput
                aria-label={`Réponse ${i + 1}`}
                value={c.texte}
                maxLength={300}
                onChange={(e) => fixerChoix(q.choix.map((d, j) => (i === j ? { ...d, texte: e.target.value } : d)))}
                className="h-10 min-w-0 flex-1"
              />
              {q.choix.length > MIN_CHOIX && (
                <IconButton
                  icon={Cancel01Icon}
                  label={`Retirer la réponse ${i + 1}`}
                  variant="discret"
                  size="sm"
                  onClick={() => {
                    const restants = q.choix.filter((_, j) => j !== i);
                    fixerChoix(choixMultiple ? restants : uneSeule(restants));
                  }}
                />
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="contour"
            size="sm"
            iconLeft={Add01Icon}
            disabled={q.choix.length >= MAX_CHOIX}
            onClick={() => fixerChoix([...q.choix, { texte: "", correcte: false }])}
            className="self-start"
          >
            Ajouter une réponse
          </Button>
        </fieldset>
      )}

      {q.genre === "courte" && (
        <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
          <legend className="mb-1 p-0 text-sm leading-5 font-medium text-encre">Réponses acceptées</legend>
          <p className="m-0 mb-1 text-xs leading-[18px] text-discret">Corrigée sans tenir compte des majuscules, des accents ni des espaces en trop.</p>
          {q.reponses.map((r, i) => (
            <div key={i} className="flex min-w-0 items-center gap-2">
              <TextInput
                aria-label={`Réponse acceptée ${i + 1}`}
                value={r}
                maxLength={300}
                onChange={(e) => fixerReponses(q.reponses.map((s, j) => (i === j ? e.target.value : s)))}
                className="h-10 min-w-0 flex-1"
              />
              {q.reponses.length > 1 && (
                <IconButton icon={Cancel01Icon} label={`Retirer la réponse acceptée ${i + 1}`} variant="discret" size="sm" onClick={() => fixerReponses(q.reponses.filter((_, j) => j !== i))} />
              )}
            </div>
          ))}
          <Button type="button" variant="contour" size="sm" iconLeft={Add01Icon} onClick={() => fixerReponses([...q.reponses, ""])} className="self-start">
            Ajouter une réponse acceptée
          </Button>
        </fieldset>
      )}

      <Field label="Explication (facultative)" htmlFor={`${id}-explication`} hint="Montrée après le quiz, avec la bonne réponse.">
        <Textarea id={`${id}-explication`} rows={2} maxLength={1000} value={q.explication} onChange={(e) => onChange((actuelle) => ({ ...actuelle, explication: e.target.value }))} />
      </Field>
    </fieldset>
  );
}
