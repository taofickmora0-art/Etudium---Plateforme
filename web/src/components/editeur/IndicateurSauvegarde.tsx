import { cn } from "@/lib/cn";
import type { EtatSauvegarde } from "./useSauvegardeAuto";

/** « 14 h 32 », à l'heure de l'appareil. */
function heure(iso: string): string | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}

export function libelleSauvegarde(etat: EtatSauvegarde): string {
  switch (etat.type) {
    case "modifie":
      return "Modifications non enregistrées";
    case "en_cours":
      return "Enregistrement…";
    case "hors_ligne":
      return "Hors ligne : vos modifications sont gardées sur cet appareil";
    case "echec":
      return "Échec de l’enregistrement. Nouvel essai…";
    case "conflit":
      return "Non enregistré";
    case "invalide":
      return "Non enregistré : à corriger";
    case "a_jour": {
      const base = etat.brouillon ? "Brouillon enregistré" : "Enregistré";
      const h = etat.le ? heure(etat.le) : null;
      return h ? `${base} à ${h}` : base;
    }
  }
}

const TONS: Record<EtatSauvegarde["type"], string> = {
  modifie: "text-discret",
  en_cours: "text-discret",
  a_jour: "text-reussite-texte",
  hors_ligne: "text-attention-texte",
  echec: "text-attention-texte",
  conflit: "text-erreur-texte",
  invalide: "text-erreur-texte",
};

/** L'état de la sauvegarde automatique (fin du lot 4, spec §2.1), annoncé aux lecteurs d'écran. */
export function IndicateurSauvegarde({ etat, className }: { etat: EtatSauvegarde; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={cn("min-w-0 text-[13px] leading-5 font-medium max-sm:text-xs", TONS[etat.type], className)}>
      {libelleSauvegarde(etat)}
    </span>
  );
}
