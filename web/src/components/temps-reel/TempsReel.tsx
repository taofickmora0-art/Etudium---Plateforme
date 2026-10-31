"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signalerTempsReel, type EvenementTempsReel } from "./evenements";

/**
 * Le temps réel (liste du 31 octobre 2026 ; migration 0044) : l'appli s'abonne, en privé, à « compte:<id> » (ses
 * notifications et ses messages) et à « communaute » (une publication qui paraît). Chaque événement est relayé dans la
 * page ; rien du contenu ne passe par là, chacun relit ce qui le concerne. Après une coupure, la reconnexion fait tout
 * relire. Sans configuration Supabase, sans session ou sans temps réel, rien ne casse : la relecture régulière continue.
 * Le compte vient de la session du navigateur ; Supabase revérifie, avec le jeton, le droit de s'abonner à son sujet.
 */
export function TempsReel() {
  useEffect(() => {
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    let fini = false;
    const canaux: RealtimeChannel[] = [];
    const prive = { config: { private: true } };

    /** Le premier abonnement ne relit rien (la page vient de charger) ; les suivants (reconnexion) relisent tout. */
    const rattraper = (evenements: EvenementTempsReel[]) => {
      let deja = false;
      return (etat: string) => {
        if (etat !== "SUBSCRIBED") return;
        if (deja) evenements.forEach(signalerTempsReel);
        deja = true;
      };
    };

    void (async () => {
      let compteId: string;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        compteId = data.session.user.id;
        // Le jeton de la session : Supabase vérifie que le compte a le droit de s'abonner à ces sujets.
        await supabase.realtime.setAuth(data.session.access_token);
      } catch {
        return;
      }
      if (fini) return;
      canaux.push(
        supabase
          .channel(`compte:${compteId}`, prive)
          .on("broadcast", { event: "notification" }, () => signalerTempsReel("notification"))
          .on("broadcast", { event: "message" }, () => signalerTempsReel("message"))
          .subscribe(rattraper(["notification", "message"])),
        supabase
          .channel("communaute", prive)
          .on("broadcast", { event: "publication" }, () => signalerTempsReel("publication"))
          .subscribe(rattraper(["publication"])),
      );
    })();

    return () => {
      fini = true;
      for (const canal of canaux) void supabase.removeChannel(canal);
    };
  }, []);
  return null;
}
