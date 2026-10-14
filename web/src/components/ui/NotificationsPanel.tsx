"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert02Icon, BubbleChatIcon, CheckmarkCircle02Icon, InformationCircleIcon, Megaphone01Icon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Icon, type IconSvgElement } from "./Icon";
import { menuSeparatorClasses, menuSurfaceClasses } from "./Menu";
import { NotificationButton } from "./TopBarButtons";

// Pastille de 36 px aux couleurs de l'état (planche « Menus », « Notifications ») ; violet pour les annonces d'Étudium.
const TONES = {
  reussite: { tile: "bg-reussite-fond text-reussite-texte", icon: CheckmarkCircle02Icon },
  information: { tile: "bg-bleu-pale text-bleu", icon: InformationCircleIcon },
  attention: { tile: "bg-attention-fond text-attention-texte", icon: Alert02Icon },
  neutre: { tile: "bg-fond-doux text-ardoise-fonce", icon: BubbleChatIcon },
  annonce: { tile: "bg-premium-fond text-premium-texte", icon: Megaphone01Icon },
} as const;

export type TonNotification = keyof typeof TONES;

export type AppNotification = {
  id: string;
  tone: TonNotification;
  title: string;
  body: string;
  /** « Il y a 2 h », « Hier ». */
  when: string;
  unread: boolean;
  href?: string;
  /** Remplace l'icône du ton (caméra pour une session live…). */
  icon?: IconSvgElement;
};

type NotificationsPanelProps = {
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  /** Toutes les non lues du compte, même au-delà de celles listées (sinon : celles de la liste). */
  unreadCount?: number;
  /** Une notification choisie, avant de suivre son lien. */
  onSelect?: (id: string) => void;
  /** Page de toutes les notifications. */
  allHref?: string;
};

const ITEM = {
  panneau: "flex items-start gap-3 rounded-champ px-3 py-2.5 text-inherit no-underline transition-colors hover:bg-coque focus-etudium",
  // Page Notifications (NdNotifications) : pastille de 44 px, moment à droite.
  page: "flex min-h-12 items-center gap-3.5 px-1 py-3.5 text-inherit no-underline transition-colors hover:bg-page focus-etudium",
} as const;

/**
 * Une notification : pastille de la catégorie, titre, texte, moment, point « Non lue ». Le panneau de la cloche et la
 * page Notifications la dessinent chacun à leur façon (`variante`).
 */
export function ElementNotification({
  notification: n,
  onSelect,
  variante = "panneau",
  className,
}: {
  notification: AppNotification;
  onSelect?: (id: string) => void;
  variante?: keyof typeof ITEM;
  className?: string;
}) {
  const tone = TONES[n.tone];
  const page = variante === "page";
  const content = (
    <>
      <span className={cn("flex flex-none items-center justify-center", page ? "size-11 rounded-[13px]" : "size-9 rounded-puce", tone.tile)}>
        <Icon icon={n.icon ?? tone.icon} size={page ? 20 : 17} />
      </span>
      <span className={cn("flex min-w-0 flex-1 flex-col", page && "gap-0.5")}>
        <span className={cn("wrap-anywhere text-encre", page ? "text-[15px] leading-[22px] font-medium" : "text-sm leading-5 font-semibold")}>{n.title}</span>
        {n.body && <span className="text-[13px] leading-5 wrap-anywhere text-discret">{n.body}</span>}
        {!page && <span className="mt-0.5 text-xs leading-[18px] text-discret">{n.when}</span>}
      </span>
      {page && <span className="flex-none text-xs leading-[18px] whitespace-nowrap text-discret">{n.when}</span>}
      {n.unread &&
        (page ? (
          <span role="img" aria-label="Non lue" className="size-2 flex-none rounded-full bg-bleu" />
        ) : (
          <>
            <span aria-hidden="true" className="mt-1.5 size-2 flex-none rounded-full bg-bleu" />
            <span className="sr-only">Non lue</span>
          </>
        ))}
    </>
  );
  return n.href ? (
    <Link href={n.href} className={cn(ITEM[variante], className)} onClick={() => onSelect?.(n.id)}>
      {content}
    </Link>
  ) : (
    <div className={cn(ITEM[variante], className)}>{content}</div>
  );
}

/** Cloche de la barre du haut et son panneau : dernières notifications, « Tout marquer comme lu ». */
export function NotificationsPanel({ notifications, onMarkAllRead, unreadCount, onSelect, allHref = "/notifications" }: NotificationsPanelProps) {
  const [ouvert, setOuvert] = useState(false);
  const unread = unreadCount ?? notifications.filter((n) => n.unread).length;
  return (
    <Popover.Root open={ouvert} onOpenChange={setOuvert}>
      <Popover.Trigger asChild>
        <NotificationButton nonLues={unread > 0} aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"} />
      </Popover.Trigger>
      <Popover.Portal>
        {/* Jamais plus large que l'écran : 16 px de marge de chaque côté sur un téléphone. */}
        <Popover.Content aria-label="Notifications" align="end" sideOffset={8} collisionPadding={16} className={cn(menuSurfaceClasses, "w-[min(380px,calc(100vw-32px))]")}>
          <div className="flex items-center justify-between gap-3 py-2 pr-2 pl-3">
            <h2 className="m-0 text-base leading-6 font-semibold text-encre">Notifications</h2>
            {unread > 0 && (
              <Button variant="discret" size="sm" onClick={onMarkAllRead}>
                Tout marquer comme lu
              </Button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 pt-4 pb-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-[13px] bg-reussite-fond text-reussite-texte">
                <Icon icon={CheckmarkCircle02Icon} size={20} />
              </span>
              <p className="m-0 text-[15px] leading-[22px] font-medium text-encre">Vous êtes à jour</p>
              <p className="m-0 text-[13px] leading-5 text-discret">Aucune nouvelle notification.</p>
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {notifications.map((n) => (
                <li key={n.id}>
                  <ElementNotification
                    notification={n}
                    onSelect={(id) => {
                      setOuvert(false);
                      onSelect?.(id);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className={menuSeparatorClasses} />
          <Link
            href={allHref}
            onClick={() => setOuvert(false)}
            className="focus-etudium flex h-10 items-center justify-center rounded-puce text-sm font-medium text-bleu no-underline transition-colors hover:bg-coque"
          >
            Voir toutes les notifications
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
