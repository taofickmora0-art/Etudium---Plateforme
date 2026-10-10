"use client";

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

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
  /** Message d'erreur (« Ce code est incorrect… ») : affiché en rouge à la place de l'aide, cases en erreur. */
  error?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

const onlyDigits = (text: string) => text.replace(/\D/g, "");

/** Code de vérification en cases de 48 × 56 (planche « Formulaires », « Listes, zones de texte et code »). */
export function CodeInput({ label, value, onChange, onComplete, length = 6, hint, error, invalid, disabled, className }: CodeInputProps) {
  const id = useId();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const code = onlyDigits(value).slice(0, length);

  const focusBox = (index: number) => boxes.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  /**
   * Écrit des chiffres à partir de la case `index` (jamais après la fin du code déjà saisi : pas de trou).
   * Un code complet, collé ou inséré n'importe où, remplace tout le code : c'est presque toujours le bon code reçu.
   */
  const write = (index: number, digits: string) => {
    const full = digits.length >= length;
    const start = full ? 0 : Math.min(index, code.length);
    const next = full ? digits.slice(0, length) : (code.slice(0, start) + digits + code.slice(start + digits.length)).slice(0, length);
    onChange(next);
    if (next.length === length) onComplete?.(next);
    focusBox(full ? length - 1 : start + digits.length);
  };

  /**
   * Ce qui vient d'être tapé ou inséré dans une case, sans le chiffre qu'elle contenait déjà.
   * Le curseur est juste après le texte inséré : c'est lui qui dit où se trouvait l'ancien chiffre.
   */
  const insertedText = (raw: string, previous: string | undefined, caret: number | null) => {
    if (!previous || raw.length < 2) return raw;
    const insertedLength = raw.length - previous.length;
    if (caret !== null && caret >= insertedLength) return raw.slice(caret - insertedLength, caret);
    return raw.startsWith(previous) ? raw.slice(previous.length) : raw.slice(0, insertedLength);
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
    if (digits) write(index, digits);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={`${id}-label`} className="text-sm leading-5 font-medium text-encre">
        {label}
      </span>
      <div role="group" aria-labelledby={`${id}-label`} aria-describedby={error || hint ? `${id}-hint` : undefined} className="flex gap-2">
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
            aria-invalid={invalid || Boolean(error) || undefined}
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
              // Une case reçoit parfois tout le code (saisie automatique du téléphone) : on le répartit.
              const digits = onlyDigits(insertedText(raw, code[index], event.target.selectionStart));
              if (digits) write(index, digits);
            }}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className="box-border h-14 w-12 min-w-0 rounded-champ border border-bordure-champ bg-panneau text-center text-[22px] font-medium text-encre outline-none transition-[border-color,box-shadow] focus:border-bleu focus:shadow-focus aria-[invalid=true]:border-erreur-vif disabled:bg-page disabled:text-discret"
          />
        ))}
      </div>
      {error ? (
        <span id={`${id}-hint`} className="flex items-center gap-1.5 text-xs leading-[18px] text-erreur-texte">
          <Icon icon={AlertCircleIcon} size={14} />
          {error}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="text-xs leading-[18px] text-discret">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
