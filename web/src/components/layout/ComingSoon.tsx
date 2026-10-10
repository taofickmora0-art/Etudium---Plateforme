import type { Metadata } from "next";
import Link from "next/link";
import { Notification02Icon, Search01Icon, Shield01Icon, SparklesIcon, TeachingIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconSvgElement } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";
import { NAV_MENU_TELEPHONE, NAV_MON_ESPACE, NAV_PRINCIPALE, PAGES_A_VENIR, type PageAVenir } from "@/lib/navigation";

// Pages qui ne sont pas dans les menus, mais dans l'en-tête ou le menu du profil.
const ICONES_HORS_MENU: Partial<Record<PageAVenir, IconSvgElement>> = {
  recherche: Search01Icon,
  notifications: Notification02Icon,
  formateur: TeachingIcon,
  admin: Shield01Icon,
};

function iconePour(page: PageAVenir): IconSvgElement {
  const entree = [...NAV_PRINCIPALE, ...NAV_MON_ESPACE, ...NAV_MENU_TELEPHONE].find((e) => e.href === `/${page}`);
  return entree?.icon ?? ICONES_HORS_MENU[page] ?? SparklesIcon;
}

/** Titre d'onglet d'une page à venir : « Événements · Étudium ». */
export function comingSoonMetadata(page: PageAVenir): Metadata {
  return { title: `${PAGES_A_VENIR[page].titre} · Étudium` };
}

/** Page « Bientôt disponible » : dit ce que contiendra l'écran et à quel lot il arrive. */
export function ComingSoon({ page }: { page: PageAVenir }) {
  const { titre, quand, description } = PAGES_A_VENIR[page];
  return (
    <div className="flex flex-col gap-6">
      <Heading level="page">{titre}</Heading>
      <EmptyState
        icon={iconePour(page)}
        title="Bientôt disponible"
        description={`${description} Cette page arrive ${quand}.`}
        action={
          <Button asChild>
            <Link href="/accueil">Retour à l’accueil</Link>
          </Button>
        }
      />
    </div>
  );
}
