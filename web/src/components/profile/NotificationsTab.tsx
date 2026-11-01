"use client";

import { Fragment, useRef, useState } from "react";
import { InterrupteurPush } from "@/components/profile/InterrupteurPush";
import { Switch } from "@/components/ui/Switch";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { updatePreferences } from "@/lib/profile/actions";
import type { ProfileData } from "@/lib/profile/data";
import { CHANNELS, NOTIFICATION_CATEGORIES, type NotificationPreferences, type PreferenceKey } from "@/lib/profile/preferences";

const SEPARATEUR = <div className="h-px bg-bordure-carte" />;

/**
 * Onglet Notifications (NdProfil). Chaque interrupteur s'enregistre tout de suite ; les envois partent un par un,
 * toujours avec le dernier état. En cas d'échec, retour au dernier état enregistré, et on le dit.
 */
export function NotificationsTab({ profile }: { profile: ProfileData }) {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences>(profile.preferences);
  const enregistre = useRef(profile.preferences);
  // Le dernier état voulu : l'interrupteur push répond après l'autorisation du navigateur, avec une fonction reçue avant.
  const courant = useRef(profile.preferences);
  const aEnvoyer = useRef<NotificationPreferences | null>(null);
  const enCours = useRef(false);

  async function envoyer() {
    if (enCours.current) return;
    enCours.current = true;
    while (aEnvoyer.current) {
      const etat = aEnvoyer.current;
      aEnvoyer.current = null;
      let ok = false;
      try {
        ok = (await updatePreferences(etat)).ok;
      } catch {
        ok = false;
      }
      if (ok) {
        enregistre.current = etat;
      } else {
        aEnvoyer.current = null;
        courant.current = enregistre.current;
        setPrefs(enregistre.current);
        toast({ tone: "erreur", title: "La modification n’a pas été enregistrée.", description: "Vérifiez votre connexion, puis réessayez." });
      }
    }
    enCours.current = false;
  }

  const basculer = (cle: PreferenceKey, valeur: boolean) => {
    const suivant = { ...courant.current, [cle]: valeur };
    courant.current = suivant;
    setPrefs(suivant);
    aEnvoyer.current = suivant;
    void envoyer();
  };

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_420px] rounded-carte border border-bordure-carte bg-panneau p-6 pb-3">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 text-xl leading-7 font-semibold text-encre">Préférences de notification</h2>
          <p className="m-0 text-sm leading-[22px] text-pretty text-discret">
            Choisissez ce que vous voulez recevoir. Les messages importants (paiement, sécurité) restent envoyés par e-mail.
          </p>
        </div>
        <div className="mt-3 flex flex-col">
          {NOTIFICATION_CATEGORIES.map((c, i) => (
            <Fragment key={c.key}>
              {i > 0 && SEPARATEUR}
              <Switch
                label={c.label}
                description={c.description}
                checked={prefs[c.key]}
                onCheckedChange={(v) => basculer(c.key, v)}
                className="min-h-11 py-3"
              />
            </Fragment>
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-[1_1_300px] rounded-carte border border-bordure-carte bg-panneau p-5 pb-2">
        <h3 className="m-0 text-base leading-6 font-semibold text-encre">Canaux</h3>
        <div className="mt-1.5 flex flex-col">
          {CHANNELS.map((c, i) => (
            <Fragment key={c.key}>
              {i > 0 && SEPARATEUR}
              {c.key === "canal_push" ? (
                <InterrupteurPush actif={prefs.canal_push} onChange={(v) => basculer("canal_push", v)} />
              ) : (
                <Switch label={c.label} checked={prefs[c.key]} onCheckedChange={(v) => basculer(c.key, v)} className="min-h-11 py-2.5" />
              )}
            </Fragment>
          ))}
          {SEPARATEUR}
          <div className="flex min-h-11 items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] leading-[22px] font-medium text-encre">E-mail</span>
              <span className="text-[13px] leading-5 text-discret">Pour les messages importants</span>
            </div>
            <Tag tone="enAttente">Toujours actif</Tag>
          </div>
        </div>
      </div>
    </div>
  );
}
