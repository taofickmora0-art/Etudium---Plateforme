import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devOnlyPagesVisible } from "@/lib/dev-only";
import { Boutons } from "./sections/Boutons";
import { Cartes } from "./sections/Cartes";
import { Fondations } from "./sections/Fondations";
import { Formulaires } from "./sections/Formulaires";
import { Menus } from "./sections/Menus";
import { Modales } from "./sections/Modales";
import { Navigation } from "./sections/Navigation";
import { Retours } from "./sections/Retours";

export const metadata: Metadata = {
  title: "Vitrine des composants · Étudium",
  robots: { index: false },
};

const PLANCHES = [
  { id: "fondations", label: "Fondations" },
  { id: "boutons", label: "Boutons" },
  { id: "formulaires", label: "Formulaires" },
  { id: "cartes", label: "Cartes" },
  { id: "navigation", label: "Navigation" },
  { id: "retours", label: "Messages" },
  { id: "menus", label: "Menus" },
  { id: "modales", label: "Modales" },
];

/** Vitrine des composants : outil de développement, sur l'ordinateur seulement (jamais sur le site en ligne). */
export default function VitrinePage() {
  if (!devOnlyPagesVisible()) notFound();
  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-12 px-4 py-8 sm:px-14 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="m-0 text-[13.5px] leading-5 font-medium tracking-[0.04em] text-ardoise uppercase">Vitrine · tâche 0.2</p>
        <nav aria-label="Planches" className="flex flex-wrap gap-2">
          {PLANCHES.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="focus-etudium cible-tactile relative rounded-champ bg-panneau px-3.5 py-2 text-sm font-medium text-texte hover:bg-coque"
            >
              {p.label}
            </a>
          ))}
        </nav>
      </header>
      <Fondations />
      <Boutons />
      <Formulaires />
      <Cartes />
      <Navigation />
      <Retours />
      <Menus />
      <Modales />
    </div>
  );
}
