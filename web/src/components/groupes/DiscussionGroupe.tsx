"use client";

import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown01Icon, ArrowLeft01Icon, Delete02Icon, Notification01Icon, NotificationOff01Icon, PinIcon, PinOffIcon } from "@hugeicons/core-free-icons";
import { FenetreSignalement } from "@/components/communaute/FenetreSignalement";
import { useMaintenant } from "@/components/notifications/horloge";
import { suivreGroupes, useTempsReelGroupes } from "@/components/temps-reel/groupes";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { IconButton } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useClavier } from "@/components/ui/useClavier";
import { cn } from "@/lib/cn";
import {
  couperGroupe,
  envoyerMessageGroupe,
  epinglerMessageGroupe,
  marquerGroupeLu,
  modifierMessageGroupe,
  reagirMessageGroupe,
  relireGroupe,
  relireMessages,
  signalerMessageGroupe,
  supprimerMessageGroupe,
} from "@/lib/groupes/actions";
import { CHEMINS_GROUPES, extrait, grouperFil, nomAuteur } from "@/lib/groupes/regles";
import type { EspaceGroupes, FilGroupe, GroupeOuvert, MessageGroupe } from "@/lib/groupes/types";
import { libelleVocal, type NoteVocale } from "@/lib/vocal/regles";
import { ChampGroupe } from "./ChampGroupe";
import { MessageDuFil, type ActionMessage } from "./MessageDuFil";
import { TuileGroupe } from "./TuileGroupe";
import { rafraichirGroupesNonLus } from "./useGroupesNonLus";

const ECHEC = "L’opération n’a pas abouti. Réessayez.";
/** En secours du temps réel, onglet visible. */
const RELECTURE_MS = 20_000;
/** À moins de 80 px du bas, on y est encore : un nouveau message y fait défiler. */
const PRES_DU_BAS = 80;
/** Pour retrouver un message cité plus ancien : 10 pages de plus au plus. */
const PAGES_MAX = 10;

/**
 * Les messages relus (les derniers) fondus dans ceux de l'écran : les plus anciens déjà chargés restent, les autres sont
 * remplacés (une modification, une réaction, une suppression) ; ceux envoyés depuis l'écran et pas encore rendus restent.
 */
function fondre(avant: MessageGroupe[], relus: MessageGroupe[]): MessageGroupe[] {
  const premier = relus[0]?.creeLe;
  const connus = new Set(relus.map((m) => m.id));
  const dernier = relus.at(-1)?.creeLe ?? "";
  const anciens = premier ? avant.filter((m) => m.creeLe < premier && !connus.has(m.id)) : [];
  const locaux = avant.filter((m) => !connus.has(m.id) && m.creeLe > dernier);
  return [...anciens, ...relus, ...locaux];
}

/** Ce que les lecteurs d'écran entendent quand des messages arrivent. */
function annonceDe(arrives: MessageGroupe[]): string {
  if (arrives.length === 1) {
    const m = arrives[0];
    return `Nouveau message de ${nomAuteur(m.auteur)} : ${m.texte ? extrait(m.texte, 120) : m.image ? "une image" : ""}`;
  }
  return `${arrives.length} nouveaux messages`;
}

/**
 * La discussion d'un groupe (spec des groupes, §2) : l'en-tête (nom, membres, « Couper les notifications »), le message
 * épinglé, le fil (les plus récents en bas, « Charger les messages précédents » en haut, séparateurs de jours, messages
 * groupés par auteur) et le champ d'écriture. En direct (0075) : un message arrive sans recharger ; la page défile en bas
 * si l'on y était, sinon « Nouveaux messages » apparaît. Les messages vus sont marqués lus. Sur téléphone, clavier
 * ouvert, la discussion occupe la partie visible de l'écran : le champ reste au-dessus du clavier.
 */
export function DiscussionGroupe({
  espace,
  groupeInitial,
  filInitial,
  cible = null,
}: {
  espace: EspaceGroupes;
  groupeInitial: GroupeOuvert;
  filInitial: FilGroupe;
  /** Le message d'une notification (?message=…) : la page s'y place et le met en valeur. */
  cible?: string | null;
}) {
  const { toast } = useToast();
  const maintenant = useMaintenant();
  const [groupe, setGroupe] = useState(groupeInitial);
  const [messages, setMessages] = useState(filInitial.messages);
  const [plusAnciens, setPlusAnciens] = useState(filInitial.plusAnciens);
  const [chargement, setChargement] = useState(false);
  const [reponse, setReponse] = useState<MessageGroupe | null>(null);
  const [edition, setEdition] = useState<MessageGroupe | null>(null);
  const [nouveaux, setNouveaux] = useState(0);
  const [annonce, setAnnonce] = useState("");
  const [surligne, setSurligne] = useState<string | null>(null);
  const [image, setImage] = useState<MessageGroupe | null>(null);
  const [suppression, setSuppression] = useState<MessageGroupe | null>(null);
  const [erreurSuppression, setErreurSuppression] = useState<string>();
  const [signalement, setSignalement] = useState<MessageGroupe | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const zone = useRef<HTMLDivElement>(null);
  const courants = useRef(messages);
  const enBas = useRef(true);
  const defiler = useRef<"bas" | null>(null);
  const hauteurAvant = useRef<number | null>(null);
  const dernierLu = useRef<string | null>(null);
  const minuterieLecture = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clavier = useClavier(true);
  const chemins = CHEMINS_GROUPES[espace];
  const droits = { peutModerer: groupe.peutModerer, equipe: groupe.equipe, peutEcrire: groupe.peutEcrire };

  useEffect(() => {
    courants.current = messages;
  }, [messages]);

  // Le temps réel suit ce groupe tant que la discussion est ouverte.
  useEffect(() => {
    suivreGroupes("discussion", [groupe.id]);
    return () => suivreGroupes("discussion", []);
  }, [groupe.id]);

  const versLeBas = useCallback(() => {
    const z = zone.current;
    if (z) z.scrollTop = z.scrollHeight;
    enBas.current = true;
    setNouveaux(0);
  }, []);

  /** Lu jusqu'au dernier message visible (onglet visible), s'il est plus récent que le dernier marqué. */
  const marquerVus = useCallback(() => {
    const z = zone.current;
    if (!z || document.visibilityState === "hidden") return;
    const bas = z.getBoundingClientRect().bottom;
    let vu: MessageGroupe | null = null;
    for (const m of courants.current) {
      const element = z.querySelector(`[data-message="${m.id}"]`);
      if (element && element.getBoundingClientRect().top <= bas) vu = m;
    }
    if (!vu || (dernierLu.current && vu.creeLe <= dernierLu.current)) return;
    dernierLu.current = vu.creeLe;
    void marquerGroupeLu(groupe.id, vu.id).then(
      (r) => {
        if (r.ok) rafraichirGroupesNonLus();
      },
      () => undefined,
    );
  }, [groupe.id]);

  const marquerBientot = useCallback(() => {
    if (minuterieLecture.current) return;
    minuterieLecture.current = setTimeout(() => {
      minuterieLecture.current = null;
      marquerVus();
    }, 400);
  }, [marquerVus]);
  useEffect(() => () => {
    if (minuterieLecture.current) clearTimeout(minuterieLecture.current);
  }, []);

  /** Va au message (le charge s'il est plus ancien) et le met en valeur un instant. */
  const allerAuMessage = useCallback(
    async (id: string) => {
      let liste = courants.current;
      let encore = plusAnciens;
      for (let page = 0; page < PAGES_MAX && encore && !liste.some((m) => m.id === id); page++) {
        const fil = await relireMessages(groupe.id, liste[0]?.id ?? null);
        if (!fil) break;
        liste = [...fil.messages.filter((m) => !liste.some((x) => x.id === m.id)), ...liste];
        encore = fil.plusAnciens;
        courants.current = liste;
        setMessages(liste);
        setPlusAnciens(encore);
      }
      if (!liste.some((m) => m.id === id)) {
        toast({ tone: "information", title: "Ce message n’est plus dans le fil." });
        return;
      }
      setSurligne(id);
      requestAnimationFrame(() => {
        const element = zone.current?.querySelector<HTMLElement>(`[data-message="${id}"]`);
        element?.scrollIntoView?.({ block: "center" });
      });
      setTimeout(() => setSurligne((actuel) => (actuel === id ? null : actuel)), 2500);
    },
    [groupe.id, plusAnciens, toast],
  );

  // À l'ouverture : en bas du fil, ou sur le message de la notification ; puis les messages vus sont marqués lus.
  const ouvrir = useEffectEvent(() => {
    if (cible && courants.current.some((m) => m.id === cible)) void allerAuMessage(cible);
    else versLeBas();
    marquerVus();
  });
  useLayoutEffect(() => {
    ouvrir();
  }, []);

  // Après un rendu : en bas si demandé, ou la même position après « Charger les messages précédents ».
  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    if (hauteurAvant.current !== null) {
      z.scrollTop += z.scrollHeight - hauteurAvant.current;
      hauteurAvant.current = null;
    } else if (defiler.current === "bas") {
      defiler.current = null;
      z.scrollTop = z.scrollHeight;
    }
  }, [messages]);

  /** Relit les derniers messages (et l'en-tête après un changement) ; une relecture qui échoue ne change rien. */
  async function relire(evenement: "message" | "changement") {
    const [fil, entete] = await Promise.all([relireMessages(groupe.id), evenement === "changement" ? relireGroupe(groupe.slug) : null]);
    if (entete?.ouvert) setGroupe(entete);
    if (!fil) return;
    const avant = courants.current;
    const connus = new Set(avant.map((m) => m.id));
    const arrives = fil.messages.filter((m) => !connus.has(m.id) && !m.deMoi);
    const suivants = fondre(avant, fil.messages);
    courants.current = suivants;
    setMessages(suivants);
    if (arrives.length === 0) return;
    setAnnonce(annonceDe(arrives));
    if (enBas.current) {
      defiler.current = "bas";
      marquerBientot();
    } else {
      setNouveaux((n) => n + arrives.length);
    }
  }
  useTempsReelGroupes((signal) => {
    if (signal.groupe === groupe.id) void relire(signal.evenement);
  });
  const relireEnSecours = useEffectEvent(() => void relire("message"));
  useEffect(() => {
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") relireEnSecours();
    }, RELECTURE_MS);
    const visible = () => {
      if (document.visibilityState === "visible") marquerVus();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(minuterie);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [marquerVus]);

  function surDefilement() {
    const z = zone.current;
    if (!z) return;
    enBas.current = z.scrollHeight - z.scrollTop - z.clientHeight < PRES_DU_BAS;
    if (enBas.current) setNouveaux(0);
    marquerBientot();
  }

  async function precedents() {
    const premier = courants.current[0];
    if (!premier || chargement) return;
    setChargement(true);
    const fil = await relireMessages(groupe.id, premier.id).catch(() => null);
    setChargement(false);
    if (!fil) return setErreur("Les messages précédents n’ont pas pu être chargés. Réessayez.");
    hauteurAvant.current = zone.current?.scrollHeight ?? null;
    const suivants = [...fil.messages.filter((m) => !courants.current.some((x) => x.id === m.id)), ...courants.current];
    courants.current = suivants;
    setMessages(suivants);
    setPlusAnciens(fil.plusAnciens);
  }

  /** Remplace un message de l'écran. */
  function remplacer(id: string, changer: (m: MessageGroupe) => MessageGroupe) {
    setMessages((liste) => liste.map((m) => (m.id === id ? changer(m) : m)));
  }

  async function envoyer(texte: string, chemin: string | null, vocal: NoteVocale | null = null): Promise<string | null> {
    const r = await envoyerMessageGroupe(groupe.id, texte, chemin, reponse?.id ?? null, ...(vocal ? [vocal] : [])).catch(() => ({ ok: false as const, message: "Votre message n’a pas pu être envoyé. Réessayez." }));
    if (!r.ok) return r.message;
    setReponse(null);
    const suivants = courants.current.some((m) => m.id === r.message.id) ? courants.current : [...courants.current, r.message];
    courants.current = suivants;
    defiler.current = "bas";
    enBas.current = true;
    setNouveaux(0);
    setMessages(suivants);
    dernierLu.current = r.message.creeLe;
    return null;
  }

  async function modifier(id: string, texte: string): Promise<string | null> {
    const r = await modifierMessageGroupe(id, texte).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!r.ok) return r.message;
    remplacer(id, () => r.message);
    setEdition(null);
    return null;
  }

  async function reagir(m: MessageGroupe, emoji: string) {
    const r = await reagirMessageGroupe(m.id, emoji).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!r.ok) return setErreur(r.message);
    setErreur(null);
    remplacer(m.id, (x) => ({ ...x, reactions: r.reactions }));
  }

  async function epingler(m: MessageGroupe, oui: boolean) {
    const r = await epinglerMessageGroupe(m.id, oui).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!r.ok) return setErreur(r.message);
    setErreur(null);
    setMessages((liste) => liste.map((x) => ({ ...x, epingle: oui ? x.id === m.id : x.id === m.id ? false : x.epingle })));
    setGroupe((g) => ({ ...g, epingle: oui ? { ...m, epingle: true } : null }));
    toast({ tone: "reussite", title: oui ? "Message épinglé" : "Message désépinglé", description: oui ? "Il s’affiche en haut du groupe." : undefined });
  }

  async function supprimer() {
    if (!suppression) return;
    const r = await supprimerMessageGroupe(suppression.id).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!r.ok) {
      setErreurSuppression(r.message);
      throw new Error(r.message);
    }
    const id = suppression.id;
    remplacer(id, (x) => ({ ...x, supprime: true, texte: "", image: null, reactions: [], epingle: false }));
    if (groupe.epingle?.id === id) setGroupe((g) => ({ ...g, epingle: null }));
    if (reponse?.id === id) setReponse(null);
    if (edition?.id === id) setEdition(null);
    toast({ tone: "reussite", title: "Message supprimé" });
  }

  async function couper() {
    const r = await couperGroupe(groupe.id, !groupe.coupe).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!r.ok) return setErreur(r.message);
    setErreur(null);
    setGroupe((g) => ({ ...g, coupe: r.coupe }));
    rafraichirGroupesNonLus();
    toast(
      r.coupe
        ? { tone: "information", title: "Notifications coupées", description: "Vous ne serez plus prévenu des réponses à vos messages dans ce groupe." }
        : { tone: "reussite", title: "Notifications rétablies", description: "Vous serez prévenu quand on répond à vos messages." },
    );
  }

  function agir(m: MessageGroupe, action: ActionMessage) {
    if (action === "repondre") {
      setEdition(null);
      setReponse(m);
    } else if (action === "copier") {
      void navigator.clipboard?.writeText(m.texte).then(
        () => toast({ tone: "reussite", title: "Texte copié" }),
        () => toast({ tone: "erreur", title: "Le texte n’a pas pu être copié." }),
      );
    } else if (action === "modifier") {
      setReponse(null);
      setEdition(m);
    } else if (action === "epingler" || action === "desepingler") {
      void epingler(m, action === "epingler");
    } else if (action === "signaler") {
      setSignalement(m);
    } else if (action === "supprimer") {
      setErreurSuppression(undefined);
      setSuppression(m);
    }
  }

  const jours = grouperFil(messages, maintenant);
  const titreId = `groupe-${groupe.id}-titre`;
  // Clavier ouvert sur téléphone : la discussion couvre la partie visible de l'écran, champ compris.
  const styleClavier = clavier ? { position: "fixed" as const, top: `${clavier.haut}px`, left: 0, right: 0, height: `${clavier.visible}px`, zIndex: 40, borderRadius: 0 } : undefined;

  return (
    <section
      aria-labelledby={titreId}
      style={styleClavier}
      className="box-border flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-panneau"
    >
      <header className="flex min-w-0 items-center gap-3 px-5 py-3.5 max-sm:gap-2.5 max-sm:px-3 max-sm:py-2.5">
        <Link href={chemins.liste} aria-label="Tous les groupes" className={cn(buttonVariants({ variant: "discret", size: "sm" }), "-ml-1.5 px-1.5 md:hidden")}>
          <Icon icon={ArrowLeft01Icon} size={20} />
        </Link>
        <TuileGroupe type={groupe.type} couleur={groupe.couleur} className="size-11 max-sm:size-9 max-sm:[&_svg]:size-[18px]" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 id={titreId} className="m-0 truncate text-lg leading-[26px] font-semibold text-encre max-sm:text-[15px] max-sm:leading-[22px]">
            {groupe.nom}
          </h1>
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] leading-5 text-discret max-sm:text-xs max-sm:leading-[18px]">
            <span>{`${groupe.membres.toLocaleString("fr-FR")} membre${groupe.membres > 1 ? "s" : ""}`}</span>
            {groupe.type === "formation" && <span>· Groupe de la formation</span>}
            {!groupe.actif && <Tag tone="enAttente">Désactivé</Tag>}
          </span>
        </div>
        <IconButton
          icon={groupe.coupe ? NotificationOff01Icon : Notification01Icon}
          label={groupe.coupe ? "Rétablir les notifications" : "Couper les notifications"}
          title={groupe.coupe ? "Rétablir les notifications" : "Couper les notifications"}
          aria-pressed={groupe.coupe}
          variant="discret"
          onClick={() => void couper()}
        />
      </header>
      {groupe.epingle && (
        <div className="flex min-w-0 items-center gap-1 border-t border-bordure-carte bg-page px-4 py-1.5 max-sm:px-2.5">
          <button
            type="button"
            onClick={() => void allerAuMessage(groupe.epingle!.id)}
            className="focus-etudium flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-champ border-0 bg-transparent px-1.5 text-left"
          >
            <Icon icon={PinIcon} size={16} className="flex-none text-bleu" />
            <span className="flex min-w-0 flex-col">
              <span className="text-xs leading-[18px] font-semibold text-bleu">Message épinglé</span>
              <span className="truncate text-[13px] leading-5 text-texte">
                {`${nomAuteur(groupe.epingle.auteur)} : ${groupe.epingle.texte ? extrait(groupe.epingle.texte, 140) : groupe.epingle.vocal ? libelleVocal(groupe.epingle.vocal.dureeMs) : groupe.epingle.image ? "Image" : ""}`}
              </span>
            </span>
          </button>
          {groupe.peutModerer && <IconButton icon={PinOffIcon} label="Désépingler le message" variant="discret" size="sm" onClick={() => void epingler(groupe.epingle!, false)} />}
        </div>
      )}
      <div className="h-px flex-none bg-bordure-carte" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={zone}
          role="log"
          aria-live="off"
          aria-label={`Messages du groupe ${groupe.nom}`}
          tabIndex={0}
          onScroll={surDefilement}
          className="focus-etudium flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-page px-5 pt-3 pb-4 max-sm:px-3"
        >
          {plusAnciens && (
            <Button variant="discret" size="sm" className="self-center" loading={chargement} onClick={() => void precedents()}>
              Charger les messages précédents
            </Button>
          )}
          {messages.length === 0 && (
            <p className="m-auto max-w-[320px] text-center text-sm leading-[22px] text-pretty text-discret">
              {groupe.peutEcrire ? "Aucun message pour l’instant. Lancez la discussion !" : "Aucun message dans ce groupe."}
            </p>
          )}
          {jours.map((j) => (
            <div key={j.cle} className="flex flex-col">
              <div className="sticky top-0 z-[1] mt-3 mb-1 flex justify-center">
                <span className="rounded-full bg-panneau px-3 py-1 text-xs leading-[18px] font-medium text-texte shadow-pastille">{j.libelle}</span>
              </div>
              {j.blocs.map((b) =>
                b.messages.map((m, i) => (
                  <MessageDuFil
                    key={m.id}
                    message={m}
                    premier={i === 0}
                    droits={droits}
                    maintenant={maintenant}
                    surligne={surligne === m.id}
                    onAction={(action) => agir(m, action)}
                    onReagir={(emoji) => void reagir(m, emoji)}
                    onCitation={(id) => void allerAuMessage(id)}
                    onImage={() => setImage(m)}
                  />
                )),
              )}
            </div>
          ))}
        </div>
        {nouveaux > 0 && (
          <Button size="sm" iconLeft={ArrowDown01Icon} className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-menu" onClick={versLeBas}>
            {nouveaux > 1 ? `${nouveaux} nouveaux messages` : "Nouveau message"}
          </Button>
        )}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {annonce}
      </div>
      {erreur && (
        <p role="alert" className="m-0 border-t border-bordure-carte px-5 pt-2 text-[13px] leading-5 text-erreur-texte max-sm:px-3">
          {erreur}
        </p>
      )}
      <div className="h-px flex-none bg-bordure-carte" />
      {groupe.peutEcrire ? (
        <ChampGroupe
          nomGroupe={groupe.nom}
          reponse={reponse}
          edition={edition}
          onAnnuler={() => {
            setReponse(null);
            setEdition(null);
          }}
          onEnvoyer={envoyer}
          onModifier={modifier}
        />
      ) : (
        <p className="m-0 px-5 py-4 text-center text-sm leading-[22px] text-discret max-sm:px-3">Ce groupe est désactivé : personne ne peut y écrire.</p>
      )}

      <Dialog
        open={image !== null}
        onOpenChange={(ouvert) => !ouvert && setImage(null)}
        title={image ? `Image de ${image.deMoi ? "vous" : nomAuteur(image.auteur)}` : "Image"}
        className="w-[min(92vw,960px)] max-w-none p-4 max-sm:p-3"
      >
        {image?.image?.url && (
          // eslint-disable-next-line @next/next/no-img-element -- image privée, servie par un lien signé d'une heure
          <img src={image.image.url} alt={image.texte ? extrait(image.texte, 200) : "Image envoyée dans le groupe"} className="mx-auto block max-h-[75dvh] max-w-full rounded-champ object-contain" />
        )}
      </Dialog>
      <ConfirmDialog
        open={suppression !== null}
        onOpenChange={(ouvert) => !ouvert && setSuppression(null)}
        tone="danger"
        icon={Delete02Icon}
        title="Supprimer ce message ?"
        description={suppression?.deMoi ? "« Message supprimé » restera affiché à sa place." : "« Message supprimé » restera affiché à sa place. Son auteur ne sera pas prévenu."}
        confirmLabel="Supprimer"
        errorMessage={erreurSuppression}
        onConfirm={supprimer}
      />
      {signalement && (
        <FenetreSignalement
          cible={{ messageGroupeId: signalement.id }}
          open
          onOpenChange={(ouvert) => !ouvert && setSignalement(null)}
          envoi={(motif, precisions) => signalerMessageGroupe(signalement.id, motif, precisions)}
        />
      )}
    </section>
  );
}
