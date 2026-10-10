import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "./Icon";

type BreadcrumbProps = {
  /** Du plus général au plus précis ; le dernier est la page courante (sans lien). */
  items: { label: string; href?: string }[];
};

/** Fil d’Ariane : liens gris, chevrons, page courante en gras foncé. */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Fil d’Ariane">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-sm leading-5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li className="flex min-w-0 items-center">
                {last || !item.href ? (
                  <span aria-current={last ? "page" : undefined} className={last ? "font-medium text-encre" : "text-discret"}>
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href} className="focus-etudium text-discret no-underline transition-colors hover:text-texte">
                    {item.label}
                  </Link>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="flex text-discret">
                  <Icon icon={ArrowRight01Icon} size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
