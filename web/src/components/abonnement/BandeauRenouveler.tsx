"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { dateLongue, joursRestants } from "@/lib/abonnement/regles";
import type { EtatAbonnement } from "@/lib/abonnement/types";

// « Plus tard » masque le bandeau jusqu'au lendemain : la date du jour (au Bénin) est gardée dans ce navigateur.
const CLE = "etudium.renouveler.masque";
const JOUR = 86_400_000;
const APRES_EXPIRATION_JOURS = 30;

const ecouteurs = new Set<() => void>();
const ecouter = (rappel: () => void) => {
  ecouteurs.add(rappel);
  return () => ecouteurs.delete(rappel);
};
function lireMasque(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}
function masquer(jour: string) {
  try {
    localStorage.setItem(CLE, jour);
  } catch {
    // Stockage refusé (navigation privée) : masqué pour cette page seulement.
  }
  ecouteurs.forEach((rappel) => rappel());
}

/** « 2026-11-01 », le jour au Bénin (UTC+1 fixe). */
const jourBenin = (iso: string) => new Date(Date.parse(iso) + 3_600_000).toISOString().slice(0, 10);

/** « dans 5 jours », « demain », « aujourd’hui ». */
const quand = (jours: number) => (jours <= 0 ? "aujourd’hui" : jours === 1 ? "demain" : `dans ${jours} jours`);

/**
 * Le bandeau « Renouveler » en tête de l'Accueil (lot 2, spec §6 ; NdAccueil, NdMobAccueil) : 7 jours avant la fin de
 * l'abonnement, puis pendant 30 jours après son expiration. Au téléphone, seule la première phrase.
 */
export function BandeauRenouveler({ abonnement, maintenant }: { abonnement: EtatAbonnement; maintenant: string }) {
  const jour = jourBenin(maintenant);
  const masque = useSyncExternalStore(ecouter, () => lireMasque() === jour, () => false);
  if (masque || abonnement.etat === "gratuit") return null;

  const instant = new Date(maintenant);
  let titre: string;
  let texte: string;
  let action: string;
  if (abonnement.etat === "actif") {
    const jours = joursRestants(abonnement.fin, instant);
    if (jours > 7) return null;
    titre = `Votre abonnement ${abonnement.formule.nom} se termine ${quand(jours)}.`;
    texte = "Prolongez-le pour garder l’accès à tout. Rien ne sera supprimé.";
    action = "Prolonger";
  } else {
    if (instant.getTime() - Date.parse(abonnement.fin) > APRES_EXPIRATION_JOURS * JOUR) return null;
    titre = `Votre abonnement ${abonnement.formule.nom} a expiré le ${dateLongue(abonnement.fin)}.`;
    texte = "Renouvelez-le pour rouvrir vos formations. Rien n’a été supprimé.";
    action = "Renouveler";
  }

  return (
    <Banner
      tone="attention"
      title={titre}
      className="mb-5 max-sm:mb-4"
      action={
        <div className="flex flex-none items-center gap-1.5">
          <Button variant="discret" size="sm" onClick={() => masquer(jour)}>
            Plus tard
          </Button>
          <Button asChild variant="contour" size="sm">
            <Link href="/abonnement/souscrire">{action}</Link>
          </Button>
        </div>
      }
    >
      <span className="max-sm:hidden">{texte}</span>
    </Banner>
  );
}
