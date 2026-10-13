import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Heading, Lead } from "@/components/ui/Text";

type PageAdminProps = {
  titre: string;
  description?: string;
  /** Fil d'Ariane après la racine (le dernier élément est la page courante). */
  fil?: { label: string; href?: string }[];
  /** Bouton à droite du titre (« Nouveau parcours »…). */
  action?: ReactNode;
  /** Début du fil d'Ariane : le back-office, ou l'espace formateur (même éditeur de formation). */
  racine?: { label: string; href: string };
  children: ReactNode;
};

const BACK_OFFICE = { label: "Back-office", href: "/admin" };

/** Cadre d'une page du back-office : fil d'Ariane, titre, chapeau, action, contenu (mêmes styles que « Mon profil »). */
export function PageAdmin({ titre, description, fil, action, racine = BACK_OFFICE, children }: PageAdminProps) {
  return (
    <div className="flex flex-col">
      {fil && (
        <div className="mb-4">
          <Breadcrumb items={[racine, ...fil]} />
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-[260px]">
          <Heading level="page">{titre}</Heading>
          {description && <Lead className="mt-2.5">{description}</Lead>}
        </div>
        {action}
      </div>
      <div className="mt-[21px]">{children}</div>
    </div>
  );
}
