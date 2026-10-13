import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Notification02Icon, Shield01Icon, SparklesIcon, TeachingIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconSvgElement } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";
import { MENUS, NAV_MENU_TELEPHONE, PAGES_A_VENIR, type PageAVenir } from "@/lib/navigation";
import { SessionGuard } from "./SessionGuard";

// Pages qui ne sont pas dans les menus, mais dans l'en-tête ou le menu du profil.
const ICONES_HORS_MENU: Partial<Record<PageAVenir, IconSvgElement>> = {
  notifications: Notification02Icon,
  formateur: TeachingIcon,
  admin: Shield01Icon,
};

function iconePour(page: PageAVenir): IconSvgElement {
  const toutes = [...Object.values(MENUS).flatMap((m) => m.groupes.flatMap((g) => g.entrees)), ...NAV_MENU_TELEPHONE];
  const entree = toutes.find((e) => e.href === `/${page}` && !e.exact);
  return entree?.icon ?? ICONES_HORS_MENU[page] ?? SparklesIcon;
}

/** Titre d'onglet d'une page à venir : « Événements · Étudium ». */
export function comingSoonMetadata(page: PageAVenir): Metadata {
  return { title: `${PAGES_A_VENIR[page].titre} · Étudium` };
}

/** Le retour d'une page à venir : le tableau de bord de son espace (back-office, formateur), sinon l'accueil. */
function retourDe(page: PageAVenir) {
  if (page.startsWith("admin/")) return { href: "/admin", libelle: "Retour au tableau de bord" };
  if (page.startsWith("formateur/")) return { href: "/formateur", libelle: "Retour au tableau de bord" };
  return { href: "/accueil", libelle: "Retour à l’accueil" };
}

/** Contenu d'une page « Bientôt disponible » : ce que contiendra l'écran et à quel lot il arrive. */
export function ComingSoonView({ page }: { page: PageAVenir }) {
  const { titre, quand, description } = PAGES_A_VENIR[page];
  const retour = retourDe(page);
  return (
    <div className="flex flex-col gap-6">
      <Heading level="page">{titre}</Heading>
      <EmptyState
        icon={iconePour(page)}
        title="Bientôt disponible"
        description={`${description} Cette page arrive ${quand}.`}
        action={
          <Button asChild>
            <Link href={retour.href}>{retour.libelle}</Link>
          </Button>
        }
      />
    </div>
  );
}

/** Page « Bientôt disponible » de l'espace connecté, avec la vérification de session de chaque page. */
export function ComingSoon({ page }: { page: PageAVenir }) {
  return (
    <>
      <ComingSoonView page={page} />
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
