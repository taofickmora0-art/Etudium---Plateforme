import type { ReactNode } from "react";
import Link from "next/link";
import { Eyebrow } from "@/components/ui/Text";
import { cn } from "@/lib/cn";

// Les pages « Conditions d’utilisation » et « Politique de confidentialité » : un sommaire avec ancres, puis des sections
// numérotées. Le texte suit la typographie française (espaces insécables devant les deux-points, les points-virgules,
// les points d’interrogation et d’exclamation, et à l’intérieur des guillemets).

/** L’adresse de contact d’Étudium : questions, demandes de remboursement, droits sur les données. */
export const CONTACT = "contact@etudium.online";

/** La date de la dernière mise à jour des deux textes, affichée en haut de chaque page. */
export const MISE_A_JOUR = "12 novembre 2026";

/** Corps du texte : 15/24, et 14/22 sur téléphone. */
const CORPS = "text-[15px] leading-6 text-texte max-sm:text-sm max-sm:leading-[22px]";

/** Lien dans le texte : souligné, pour ne pas reposer sur la seule couleur. */
const LIEN = "focus-etudium rounded-sm font-medium text-bleu underline decoration-bleu/35 underline-offset-[3px] hover:decoration-bleu";

export function P({ children }: { children: ReactNode }) {
  return <p className={cn("m-0 text-pretty", CORPS)}>{children}</p>;
}

export function Liste({ children }: { children: ReactNode }) {
  return <ul className={cn("m-0 flex list-disc flex-col gap-1.5 pl-5 text-pretty marker:text-gris-icone", CORPS)}>{children}</ul>;
}

/** Intertitre dans une section (h3). */
export function SousTitre({ children }: { children: ReactNode }) {
  return <h3 className="m-0 mt-1 text-[15px] leading-6 font-semibold text-encre max-sm:text-sm max-sm:leading-[22px]">{children}</h3>;
}

/** L’adresse de contact, cliquable (mailto). */
export function LienContact() {
  return (
    <a href={`mailto:${CONTACT}`} className={LIEN}>
      {CONTACT}
    </a>
  );
}

/** Lien vers une autre page du site (l’autre texte, la vérification des certificats). */
export function LienPage({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={LIEN}>
      {children}
    </Link>
  );
}

export type SectionJuridique = { id: string; titre: string; contenu: ReactNode };

/** Le sommaire (ancres vers chaque section), puis les sections numérotées dans le même ordre. */
export function TexteJuridique({ sections }: { sections: readonly SectionJuridique[] }) {
  return (
    <>
      <nav aria-label="Sommaire" className="rounded-carte border border-bordure-carte bg-page p-4 max-sm:p-3.5">
        <Eyebrow>Sommaire</Eyebrow>
        <ol className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0">
          {sections.map((section, i) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="focus-etudium rounded-sm text-sm leading-[22px] text-bleu no-underline hover:underline max-sm:text-[13px] max-sm:leading-5"
              >
                {i + 1}. {section.titre}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      {sections.map((section, i) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-titre`} className="flex scroll-mt-4 flex-col gap-3 pt-2">
          <h2
            id={`${section.id}-titre`}
            className="m-0 text-lg leading-[26px] font-semibold text-balance text-encre max-sm:text-base max-sm:leading-6"
          >
            {i + 1}. {section.titre}
          </h2>
          {section.contenu}
        </section>
      ))}
    </>
  );
}
