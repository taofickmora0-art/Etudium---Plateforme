"use client";

import { useEffect } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { signalerGroupe, useGroupesSuivis } from "./groupes";

/**
 * Les abonnements aux groupes suivis par la page (migration 0075) : un sujet privé « groupe:<id> » par groupe, que
 * Supabase n'ouvre qu'à ses membres (règle sur realtime.messages). Après une coupure, la reconnexion fait relire le
 * groupe (des messages ont pu être manqués). Sans configuration, sans session ou sans temps réel, rien ne casse : les
 * écrans relisent aussi régulièrement.
 */
export function TempsReelGroupes() {
  const cle = useGroupesSuivis().join(",");
  useEffect(() => {
    if (!cle) return;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }
    let fini = false;
    const canaux: RealtimeChannel[] = [];
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        await supabase.realtime.setAuth(data.session.access_token);
      } catch {
        return;
      }
      if (fini) return;
      for (const groupe of cle.split(",")) {
        let deja = false;
        canaux.push(
          supabase
            .channel(`groupe:${groupe}`, { config: { private: true } })
            .on("broadcast", { event: "message" }, () => signalerGroupe(groupe, "message"))
            .on("broadcast", { event: "changement" }, () => signalerGroupe(groupe, "changement"))
            .subscribe((etat: string) => {
              if (etat !== "SUBSCRIBED") return;
              if (deja) signalerGroupe(groupe, "message");
              deja = true;
            }),
        );
      }
    })();
    return () => {
      fini = true;
      for (const canal of canaux) void supabase.removeChannel(canal);
    };
  }, [cle]);
  return null;
}
