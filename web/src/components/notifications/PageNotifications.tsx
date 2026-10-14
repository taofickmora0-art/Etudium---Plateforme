"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CheckmarkCircle02Icon, Settings02Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/Icon";
import { ElementNotification } from "@/components/ui/NotificationsPanel";
import { Heading, Lead } from "@/components/ui/Text";
import { chargerNotifications, marquerLues } from "@/lib/notifications/actions";
import { EVENEMENT_NOTIFICATIONS } from "@/lib/notifications/regles";
import { grouperParJour, heure, quand } from "@/lib/notifications/temps";
import type { LotNotifications } from "@/lib/notifications/types";
import { versPanneau } from "./affichage";

type Filtre = "toutes" | "non_lues";
const FILTRES = [
  { value: "toutes", label: "Toutes" },
  { value: "non_lues", label: "Non lues" },
];

/** La cloche de l'en-tête se recharge après chaque marquage fait ici. */
const signalerALaCloche = () => window.dispatchEvent(new Event(EVENEMENT_NOTIFICATIONS));

/**
 * La page Notifications (design NdNotifications ; spec des notifications, §3) : toutes ou les non lues, groupées par
 * jour à l'heure du Bénin, 20 à la fois (« Voir plus »). Un clic marque la notification lue et mène à son lien.
 */
export function PageNotifications({ initial }: { initial: LotNotifications }) {
  const [filtre, setFiltre] = useState<Filtre>("toutes");
  const [lot, setLot] = useState(initial);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Seule la dernière lecture compte : un filtre changé deux fois de suite ne mélange pas les réponses.
  const demande = useRef(0);
  const maintenant = new Date();

  async function charger(nonLues: boolean, avant: string | null, ajouter: boolean) {
    const numero = ++demande.current;
    setOccupe(true);
    setErreur(null);
    const reponse = await chargerNotifications(nonLues, avant);
    if (numero !== demande.current) return;
    setOccupe(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setLot((actuel) =>
      ajouter
        ? { ...reponse.page, lignes: [...actuel.lignes, ...reponse.page.lignes.filter((n) => !actuel.lignes.some((a) => a.id === n.id))] }
        : reponse.page,
    );
  }

  const changerFiltre = (valeur: string) => {
    const nouveau: Filtre = valeur === "non_lues" ? "non_lues" : "toutes";
    setFiltre(nouveau);
    void charger(nouveau === "non_lues", null, false);
  };

  async function lire(id: string) {
    setLot((actuel) => {
      const cible = actuel.lignes.find((n) => n.id === id);
      if (!cible || cible.lue) return actuel;
      return { ...actuel, nonLues: Math.max(0, actuel.nonLues - 1), lignes: actuel.lignes.map((n) => (n.id === id ? { ...n, lue: true } : n)) };
    });
    await marquerLues([id]);
    signalerALaCloche();
  }

  async function toutLire() {
    setLot((actuel) => ({ ...actuel, nonLues: 0, lignes: actuel.lignes.map((n) => ({ ...n, lue: true })) }));
    await marquerLues(null);
    signalerALaCloche();
  }

  const groupes = grouperParJour(lot.lignes, maintenant);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <Heading level="page">Notifications</Heading>
          <Lead className="mt-2.5">Corrections, sessions live, abonnement et communauté.</Lead>
        </div>
        <div className="flex flex-wrap gap-2">
          {lot.nonLues > 0 && (
            <Button variant="gris" iconLeft={Tick01Icon} onClick={() => void toutLire()}>
              Tout marquer comme lu
            </Button>
          )}
          <Button variant="contour" asChild>
            <Link href="/profil?onglet=notifications">
              <Icon icon={Settings02Icon} size={18} />
              Préférences
            </Link>
          </Button>
        </div>
      </div>

      <FilterChips className="mt-[21px]" label="Filtrer les notifications" options={FILTRES} value={filtre} onValueChange={changerFiltre} />
      <div className="mt-5 h-px bg-separateur" />

      <div className="mt-8 flex min-w-0 flex-col" aria-busy={occupe}>
        {erreur && (
          <p role="alert" className="m-0 mb-5 text-sm leading-[22px] text-erreur-texte">
            {erreur}
          </p>
        )}
        {groupes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-[13px] bg-reussite-fond text-reussite-texte">
              <Icon icon={CheckmarkCircle02Icon} size={20} />
            </span>
            <p className="m-0 text-[15px] leading-[22px] font-medium text-encre">Vous êtes à jour</p>
            <p className="m-0 text-[13px] leading-5 text-discret">Aucune notification non lue. Les prochaines apparaîtront ici.</p>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-7">
            {groupes.map((groupe, rang) => {
              // Aujourd'hui : « Il y a 2 h » ; les autres jours, sous leur date : l'heure (« 14 h 05 »).
              const aujourdhui = groupe.libelle === "Aujourd’hui";
              return (
                <section key={groupe.cle} aria-labelledby={`jour-${rang}`} className="flex min-w-0 flex-col gap-3">
                  <div className="flex items-center gap-2.5">
                    <h2 id={`jour-${rang}`} className="m-0 text-[13.5px] leading-5 font-normal tracking-[0.04em] text-ardoise uppercase">
                      {groupe.libelle}
                    </h2>
                    <span aria-hidden="true" className="h-px flex-1 bg-separateur" />
                  </div>
                  <ul className="m-0 flex min-w-0 list-none flex-col rounded-2xl border border-bordure-carte bg-panneau px-[15px] py-1">
                    {groupe.lignes.map((n, i) => (
                      <li key={n.id} className={i > 0 ? "border-t border-bordure-carte" : undefined}>
                        <ElementNotification
                          variante="page"
                          notification={versPanneau(n, maintenant, aujourdhui ? quand : (iso) => heure(iso))}
                          onSelect={(id) => void lire(id)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        {lot.suite && (
          <Button variant="contour" className="mt-6 self-center" loading={occupe} onClick={() => void charger(filtre === "non_lues", lot.lignes.at(-1)?.id ?? null, true)}>
            Voir plus
          </Button>
        )}
      </div>
    </div>
  );
}
