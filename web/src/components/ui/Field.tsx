import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { AlertCircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type ControlProps = { "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };

type FieldProps = {
  label: ReactNode;
  /** Identifiant du champ : relie le libellé, l'aide et l'erreur au contrôle. */
  htmlFor: string;
  /** Aide sous le champ (« Au moins 8 caractères. »). Remplacée par l'erreur quand il y en a une. */
  hint?: ReactNode;
  /** Message d'erreur : affiché en rouge avec une icône, et le champ passe en `aria-invalid`. */
  error?: ReactNode;
  className?: string;
  /** Un seul contrôle (TextInput, PasswordInput, Select…) : il reçoit `aria-invalid` et `aria-describedby`. */
  children: ReactElement<ControlProps>;
};

/** Libellé toujours visible au-dessus, aide ou erreur en dessous (planche « Formulaires », « Champs de texte »). */
export function Field({ label, htmlFor, hint, error, className, children }: FieldProps) {
  const messageId = `${htmlFor}-message`;
  const message = error ?? hint;
  const control = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": [children.props["aria-describedby"], message ? messageId : undefined].filter(Boolean).join(" ") || undefined,
        ...(error ? { "aria-invalid": true } : {}),
      })
    : children;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm leading-5 font-medium text-encre">
        {label}
      </label>
      {control}
      {error ? (
        <span id={messageId} className="flex items-center gap-1.5 text-xs leading-[18px] text-erreur-texte">
          <Icon icon={AlertCircleIcon} size={14} />
          {error}
        </span>
      ) : (
        hint && (
          <span id={messageId} className="text-xs leading-[18px] text-discret">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
