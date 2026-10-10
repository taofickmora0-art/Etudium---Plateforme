"use client";

import Link from "next/link";
import { Alert02Icon, BubbleChatIcon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Popover } from "radix-ui";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { Icon, type IconSvgElement } from "./Icon";
import { menuSeparatorClasses, menuSurfaceClasses } from "./Menu";
import { NotificationButton } from "./TopBarButtons";

// Pastille de 36 px aux couleurs de l'état (planche « Menus », « Notifications »).
const TONES = {
  reussite: { tile: "bg-reussite-fond text-reussite-texte", icon: CheckmarkCircle02Icon },
  information: { tile: "bg-bleu-pale text-bleu", icon: InformationCircleIcon },
  attention: { tile: "bg-attention-fond text-attention-texte", icon: Alert02Icon },
  neutre: { tile: "bg-fond-doux text-ardoise-fonce", icon: BubbleChatIcon },
} as const;

export type AppNotification = {
  id: string;
  tone: keyof typeof TONES;
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
  /** Page de toutes les notifications. */
  allHref?: string;
};

const ITEM = "flex items-start gap-3 rounded-champ px-3 py-2.5 text-inherit no-underline transition-colors hover:bg-coque focus-etudium";

/** Cloche de la barre du haut et son panneau : dernières notifications, « Tout marquer comme lu ». */
export function NotificationsPanel({ notifications, onMarkAllRead, allHref = "/notifications" }: NotificationsPanelProps) {
  const unread = notifications.filter((n) => n.unread).length;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <NotificationButton aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content aria-label="Notifications" align="end" sideOffset={8} className={cn(menuSurfaceClasses, "w-[380px]")}>
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
              {notifications.map((n) => {
                const tone = TONES[n.tone];
                const content = (
                  <>
                    <span className={cn("flex size-9 flex-none items-center justify-center rounded-puce", tone.tile)}>
                      <Icon icon={n.icon ?? tone.icon} size={17} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm leading-5 font-semibold text-encre">{n.title}</span>
                      <span className="text-[13px] leading-5 text-discret">{n.body}</span>
                      <span className="mt-0.5 text-xs leading-[18px] text-discret">{n.when}</span>
                    </span>
                    {n.unread && (
                      <>
                        <span aria-hidden="true" className="mt-1.5 size-2 flex-none rounded-full bg-bleu" />
                        <span className="sr-only">Non lue</span>
                      </>
                    )}
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} className={ITEM}>
                        {content}
                      </Link>
                    ) : (
                      <div className={ITEM}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className={menuSeparatorClasses} />
          <Link
            href={allHref}
            className="focus-etudium flex h-10 items-center justify-center rounded-puce text-sm font-medium text-bleu no-underline transition-colors hover:bg-coque"
          >
            Voir toutes les notifications
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
