"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircleIcon, Cancel01Icon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

/** Durée d'affichage d'une notification sans action. */
export const TOAST_DURATION_MS = 5000;
/** Au-delà, la plus ancienne laisse sa place. */
const MAX_TOASTS = 3;

// Planche « Messages », « Notifications éphémères » : fond encre, icône dans la couleur claire de l'état.
const TONES = {
  reussite: { glyph: CheckmarkCircle02Icon, color: "text-reussite-fond" },
  information: { glyph: InformationCircleIcon, color: "text-bleu-pale" },
  erreur: { glyph: AlertCircleIcon, color: "text-erreur-fond" },
} as const;

export type ToastOptions = {
  tone: keyof typeof TONES;
  title: string;
  description?: string;
  /** Une notification avec action reste affichée jusqu'au clic sur l'action ou sur « Fermer ». */
  action?: { label: string; onClick: () => void };
};

type ToastItem = ToastOptions & { id: number };

const ToastContext = createContext<{ toast: (options: ToastOptions) => void } | null>(null);

/** Donne accès à `toast()`. À utiliser sous un `ToastProvider`. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast doit être utilisé à l’intérieur de <ToastProvider>.");
  return context;
}

/** `toast()` s'il y a un `ToastProvider` autour, sinon null (l'en-tête peut s'afficher sans). */
export function useToastFacultatif() {
  return useContext(ToastContext)?.toast ?? null;
}

/** À monter une fois, autour de l'application : affiche les notifications en bas de l'écran. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...options, id }].slice(-MAX_TOASTS));
      if (!options.action) timers.current.set(id, setTimeout(() => dismiss(id), TOAST_DURATION_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} {...t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Une notification, telle que sur la planche. Exportée pour la vitrine ; dans l'application, passer par `toast()`. */
export function ToastView({ tone, title, description, action, onDismiss, className }: ToastOptions & { onDismiss?: () => void; className?: string }) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "pointer-events-auto box-border flex w-[360px] max-w-full items-start gap-3 rounded-carte bg-encre py-3.5 pr-3.5 pl-4 shadow-menu motion-safe:animate-apparition",
        className,
      )}
    >
      <span className={cn("mt-px flex-none", t.color)}>
        <Icon icon={t.glyph} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm leading-5 font-semibold text-white">{title}</span>
        {description && <span className="text-[13px] leading-5 text-sur-encre">{description}</span>}
      </span>
      {action && (
        <>
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss?.();
            }}
            className="focus-etudium cible-tactile relative flex-none cursor-pointer border-0 bg-transparent p-0 text-[13px] leading-5 font-semibold text-white underline"
          >
            {action.label}
          </button>
          {onDismiss && (
            <button
              type="button"
              aria-label="Fermer la notification"
              onClick={onDismiss}
              className="focus-etudium cible-tactile relative -my-0.5 flex size-6 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-sur-encre hover:text-white"
            >
              <Icon icon={Cancel01Icon} size={16} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
