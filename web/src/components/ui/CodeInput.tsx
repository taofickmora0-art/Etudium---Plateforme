"use client";

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

type CodeInputProps = {
  /** Texte visible au-dessus des cases (« Code reçu par e-mail »). */
  label: string;
  /** Les chiffres déjà saisis, sans trou : « 4821 ». */
  value: string;
  onChange: (code: string) => void;
  /** Appelé dès que toutes les cases sont remplies. */
  onComplete?: (code: string) => void;
  length?: number;
  /** Aide sous les cases (« Le code expire dans 10 minutes. »). */
  hint?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

const onlyDigits = (text: string) => text.replace(/\D/g, "");

/** Code de vérification en cases de 48 × 56 (planche « Formulaires », « Listes, zones de texte et code »). */
export function CodeInput({ label, value, onChange, onComplete, length = 6, hint, invalid, disabled, className }: CodeInputProps) {
  const id = useId();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = onlyDigits(value).slice(0, length);

  const focusBox = (index: number) => boxes.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  /** Écrit des chiffres à partir de la case `index` (jamais après la fin du code déjà saisi : pas de trou). */
  const write = (index: number, digits: string) => {
    const start = Math.min(index, code.length);
    const next = (code.slice(0, start) + digits + code.slice(start + digits.length)).slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
    focusBox(start + digits.length);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      if (index < code.length) {
        onChange(code.slice(0, index) + code.slice(index + 1));
      } else if (index > 0) {
        onChange(code.slice(0, index - 1) + code.slice(index));
        focusBox(index - 1);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(Math.min(index + 1, code.length));
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = onlyDigits(event.clipboardData.getData("text"));
    if (digits) write(index, digits.slice(0, length));
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={`${id}-label`} className="text-sm leading-5 font-medium text-encre">
        {label}
      </span>
      <div role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} className="flex gap-2">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => {
              boxes.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`Chiffre ${index + 1}`}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            value={code[index] ?? ""}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const raw = event.target.value;
              // Certains claviers de téléphone n'envoient pas la touche Retour arrière : la case se vide simplement.
              if (raw === "") {
                onChange(code.slice(0, index) + code.slice(index + 1));
                return;
              }
              // Le chiffre déjà présent n'est pas une nouvelle saisie. Une case reçoit parfois tout le code
              // (saisie automatique du téléphone) : on le répartit sur les cases suivantes.
              const typed = raw.length > 1 && code[index] ? raw.replace(code[index], "") : raw;
              const digits = onlyDigits(typed);
              if (digits) write(index, digits.slice(0, length));
            }}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className="box-border h-14 w-12 min-w-0 rounded-champ border border-bordure-champ bg-panneau text-center text-[22px] font-medium text-encre outline-none transition-[border-color,box-shadow] focus:border-bleu focus:shadow-focus aria-[invalid=true]:border-erreur-vif disabled:bg-page disabled:text-discret"
          />
        ))}
      </div>
      {hint && (
        <span id={`${id}-hint`} className="text-xs leading-[18px] text-discret">
          {hint}
        </span>
      )}
    </div>
  );
}
